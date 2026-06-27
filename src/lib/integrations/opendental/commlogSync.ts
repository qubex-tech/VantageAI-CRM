import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import { getOpenDentalServices } from './factory'
import { recordSyncResult } from './connectionManager'
import { logOpenDentalAudit } from './audit'
import { buildExternalId } from './patientSync'

type OdCommlog = {
  CommlogNum?: number | string
  PatNum?: number | string
  CommDateTime?: string
  CommType?: string
  commType?: string
  Note?: string
  Mode_?: string
  SentOrReceived?: string
  DateTStamp?: string
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

/** Offset (ms) such that `instant + offset` equals the wall-clock reading in `timeZone`. */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - instant.getTime()
}

/** Parse an Open Dental naive "yyyy-MM-dd HH:mm:ss" reading into a correct UTC instant. */
function parseOdLocalToInstant(value: unknown, timeZone: string): Date | null {
  const raw = cleanString(value)
  if (!raw) return null
  if (raw.startsWith('0001-01-01')) return null
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null
  const year = Number(match[1])
  if (year < 1900) return null
  const utcGuess = Date.UTC(
    year,
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? '0')
  )
  const offset1 = timeZoneOffsetMs(new Date(utcGuess), timeZone)
  let ts = utcGuess - offset1
  const offset2 = timeZoneOffsetMs(new Date(ts), timeZone)
  if (offset2 !== offset1) ts = utcGuess - offset2
  return new Date(ts)
}

function commlogTitle(od: OdCommlog): string {
  const kind = cleanString(od.commType) || cleanString(od.CommType)
  return kind ? `Open Dental commlog — ${kind}` : 'Open Dental commlog'
}

export type CommlogSyncSummary = {
  fetched: number
  created: number
  skipped: number
  errors: number
  errorSamples: string[]
}

/**
 * Pull Open Dental commlogs into the CRM as patient timeline entries (Activity tab).
 *
 * Deduped by the Open Dental CommlogNum stored in the timeline entry metadata, so
 * repeated pulls (including notes the CRM itself wrote back) are not duplicated.
 *
 * @param since Optional ISO timestamp; when set, only commlogs modified after then
 *   are fetched (Open Dental `DateTStamp` filter).
 */
export async function syncOpenDentalCommlogs(params: {
  practiceId: string
  actorUserId?: string
  limit?: number
  maxPages?: number
  since?: string
}): Promise<CommlogSyncSummary> {
  const { practiceId, actorUserId } = params
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 100)
  const maxPages = Math.min(Math.max(params.maxPages ?? 200, 1), 1000)

  const services = await getOpenDentalServices(practiceId)
  const timeZone = await getPracticeTimeZone(practiceId)

  const summary: CommlogSyncSummary = {
    fetched: 0,
    created: 0,
    skipped: 0,
    errors: 0,
    errorSamples: [],
  }

  const baseParams: Record<string, string | number> = {}
  if (params.since) {
    const sinceDate = new Date(params.since)
    if (!Number.isNaN(sinceDate.getTime())) {
      baseParams.DateTStamp = sinceDate.toISOString().slice(0, 19).replace('T', ' ')
    }
  }

  // Cache PatNum -> CRM patientId (or null when the patient isn't synced).
  const patientCache = new Map<number, string | null>()

  const resolvePatientId = async (patNum: number): Promise<string | null> => {
    if (patientCache.has(patNum)) return patientCache.get(patNum) ?? null
    const patient = await prisma.patient.findFirst({
      where: { practiceId, deletedAt: null, externalEhrId: buildExternalId(patNum) },
      select: { id: true },
    })
    const id = patient?.id ?? null
    patientCache.set(patNum, id)
    return id
  }

  try {
    let offset = 0
    for (let page = 0; page < maxPages; page++) {
      const batch = (await services.commlogs.list({
        ...baseParams,
        Limit: limit,
        Offset: offset,
      })) as OdCommlog[]

      if (!Array.isArray(batch) || batch.length === 0) break

      for (const od of batch) {
        summary.fetched += 1
        try {
          const commlogNum = Number(od.CommlogNum)
          const patNum = Number(od.PatNum)
          if (!Number.isInteger(commlogNum) || !Number.isInteger(patNum)) {
            summary.skipped += 1
            continue
          }

          const patientId = await resolvePatientId(patNum)
          if (!patientId) {
            summary.skipped += 1
            continue
          }

          const existing = await prisma.patientTimelineEntry.findFirst({
            where: {
              patientId,
              type: 'note',
              metadata: {
                path: ['commlogNum'],
                equals: commlogNum,
              },
            },
            select: { id: true },
          })
          if (existing) {
            summary.skipped += 1
            continue
          }

          const note = cleanString(od.Note) || '(no note text)'
          const createdAt = parseOdLocalToInstant(od.CommDateTime, timeZone) ?? new Date()

          await prisma.patientTimelineEntry.create({
            data: {
              patientId,
              type: 'note',
              title: commlogTitle(od),
              description: note,
              createdAt,
              metadata: {
                source: 'opendental',
                commlogNum,
                patNum,
                commType: cleanString(od.commType) || cleanString(od.CommType) || null,
                mode: cleanString(od.Mode_) || null,
                sentOrReceived: cleanString(od.SentOrReceived) || null,
                commDateTime: cleanString(od.CommDateTime) || null,
              } as Prisma.InputJsonObject,
            },
          })
          summary.created += 1
        } catch (error) {
          summary.errors += 1
          if (summary.errorSamples.length < 5) {
            summary.errorSamples.push(error instanceof Error ? error.message : 'unknown error')
          }
        }
      }

      if (batch.length < limit) break
      offset += limit
    }

    await recordSyncResult(practiceId, {
      status: summary.errors > 0 && summary.created === 0 ? 'error' : 'success',
      error: summary.errorSamples[0],
    })

    await logOpenDentalAudit({
      tenantId: practiceId,
      actorUserId,
      action: 'commlogs.synced',
      entity: 'Commlog',
      metadata: {
        fetched: summary.fetched,
        created: summary.created,
        skipped: summary.skipped,
        errors: summary.errors,
      },
    })

    return summary
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Commlog sync failed'
    await recordSyncResult(practiceId, { status: 'error', error: message })
    throw error
  }
}
