import { prisma } from '@/lib/db'
import type { Appointment as OdAppointment } from '@vantage/opendental-sdk'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import { getOpenDentalServices } from './factory'
import { recordSyncResult } from './connectionManager'
import { logOpenDentalAudit } from './audit'
import { ensureCrmPatientIdForPatNum } from './patientSync'

/** Each character in an Open Dental Pattern represents a 5-minute slot. */
const PATTERN_SLOT_MINUTES = 5
const DEFAULT_DURATION_MINUTES = 30

export function buildAppointmentExternalId(aptNum: number | string): string {
  return `opendental:apt:${aptNum}`
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

type WallClock = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** Parse Open Dental "YYYY-MM-DD HH:mm:ss" into wall-clock components (no timezone applied). */
function parseOdWallClock(value: unknown): WallClock | null {
  const raw = cleanString(value)
  if (!raw) return null
  if (raw.startsWith('0001-01-01')) return null
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null
  const year = Number(match[1])
  if (year < 1900) return null
  return {
    year,
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? '0'),
  }
}

/** Offset (ms) such that `utcInstant + offset` equals the wall-clock reading in `timeZone`. */
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

/** Convert a wall-clock reading in `timeZone` to the correct UTC instant (DST-aware). */
function wallClockToInstant(wall: WallClock, timeZone: string): Date {
  const utcGuess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
  const offset1 = timeZoneOffsetMs(new Date(utcGuess), timeZone)
  let ts = utcGuess - offset1
  const offset2 = timeZoneOffsetMs(new Date(ts), timeZone)
  if (offset2 !== offset1) {
    ts = utcGuess - offset2
  }
  return new Date(ts)
}

/** Parse Open Dental datetime into a correct UTC instant for the given clinic timezone. */
function parseOdDateTime(value: unknown, timeZone: string): Date | null {
  const wall = parseOdWallClock(value)
  if (!wall) return null
  return wallClockToInstant(wall, timeZone)
}

function durationFromPattern(pattern: unknown): number {
  const raw = cleanString(pattern)
  if (!raw) return DEFAULT_DURATION_MINUTES
  const slots = raw.length
  const minutes = slots * PATTERN_SLOT_MINUTES
  return minutes > 0 ? minutes : DEFAULT_DURATION_MINUTES
}

/** Map Open Dental AptStatus to the CRM appointment status vocabulary. */
function mapApptStatus(status: unknown): string {
  switch (cleanString(status)?.toLowerCase()) {
    case 'complete':
      return 'completed'
    case 'broken':
      return 'cancelled'
    case 'scheduled':
    case 'asap':
      return 'scheduled'
    default:
      return 'scheduled'
  }
}

/** Open Dental statuses that do not correspond to a real scheduled visit. */
function isSchedulableStatus(status: unknown): boolean {
  const normalized = cleanString(status)?.toLowerCase()
  if (!normalized) return true
  return normalized !== 'unschedlist' && normalized !== 'planned' && normalized !== 'ptnote'
}

type UpsertOutcome = 'created' | 'updated'

async function upsertAppointmentFromOpenDental(params: {
  practiceId: string
  patientId: string
  od: OdAppointment
  timeZone: string
}): Promise<UpsertOutcome> {
  const { practiceId, patientId, od, timeZone } = params

  const start = parseOdDateTime(od.AptDateTime, timeZone)
  if (!start) {
    throw new Error(`Appointment ${od.AptNum} has no valid AptDateTime`)
  }
  const end = new Date(start.getTime() + durationFromPattern(od.Pattern) * 60 * 1000)

  const externalKey = buildAppointmentExternalId(od.AptNum)
  const providerId = cleanString(od.provAbbr) || (od.ProvNum ? `prov:${od.ProvNum}` : null)
  const procedure = cleanString(od.ProcDescript)
  const odNote = cleanString(od.Note)
  const notes = [`Synced from Open Dental Appointment/${od.AptNum}`, odNote].filter(Boolean).join(' — ')

  const existing = await prisma.appointment.findUnique({
    where: { calBookingId: externalKey },
    select: { id: true },
  })

  const data = {
    practiceId,
    patientId,
    providerId,
    status: mapApptStatus(od.AptStatus),
    startTime: start,
    endTime: end,
    timezone: timeZone,
    visitType: procedure || 'Open Dental Appointment',
    reason: procedure,
    notes,
  }

  await prisma.appointment.upsert({
    where: { calBookingId: externalKey },
    create: {
      ...data,
      calBookingId: externalKey,
      calEventId: 'opendental',
    },
    update: data,
  })

  return existing ? 'updated' : 'created'
}

export type AppointmentSyncSummary = {
  fetched: number
  created: number
  updated: number
  skipped: number
  errors: number
  errorSamples: string[]
}

/**
 * Pull appointments from Open Dental into the CRM appointment table for a practice.
 *
 * When `dateStart`/`dateEnd` (YYYY-MM-DD) are omitted, all appointments are paged
 * through (bounded by maxPages). Patients referenced by appointments are created
 * on demand if they have not been synced yet.
 */
export async function syncOpenDentalAppointments(params: {
  practiceId: string
  actorUserId?: string
  dateStart?: string
  dateEnd?: string
  limit?: number
  maxPages?: number
  timeZone?: string
}): Promise<AppointmentSyncSummary> {
  const { practiceId, actorUserId } = params
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 100)
  const maxPages = Math.min(Math.max(params.maxPages ?? 200, 1), 1000)

  const services = await getOpenDentalServices(practiceId)
  const timeZone = params.timeZone ?? (await getPracticeTimeZone(practiceId))
  const patientCache = new Map<number, string>()

  const summary: AppointmentSyncSummary = {
    fetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorSamples: [],
  }

  const baseParams: Record<string, string | number> = {}
  if (params.dateStart) baseParams.dateStart = params.dateStart
  if (params.dateEnd) baseParams.dateEnd = params.dateEnd

  try {
    let offset = 0
    for (let page = 0; page < maxPages; page++) {
      const batch = (await services.appointments.list({
        ...baseParams,
        Limit: limit,
        Offset: offset,
      })) as OdAppointment[]

      if (!Array.isArray(batch) || batch.length === 0) break

      for (const od of batch) {
        summary.fetched += 1
        try {
          if (!isSchedulableStatus(od.AptStatus) || !parseOdWallClock(od.AptDateTime)) {
            summary.skipped += 1
            continue
          }
          if (!od.PatNum) {
            summary.skipped += 1
            continue
          }

          const patientId = await ensureCrmPatientIdForPatNum({
            practiceId,
            patNum: od.PatNum,
            services,
            cache: patientCache,
          })
          if (!patientId) {
            summary.skipped += 1
            continue
          }

          const outcome = await upsertAppointmentFromOpenDental({
            practiceId,
            patientId,
            od,
            timeZone,
          })
          if (outcome === 'created') summary.created += 1
          else summary.updated += 1
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
      status:
        summary.errors > 0 && summary.created + summary.updated === 0 ? 'error' : 'success',
      error: summary.errorSamples[0],
    })

    await logOpenDentalAudit({
      tenantId: practiceId,
      actorUserId,
      action: 'appointments.synced',
      entity: 'Appointment',
      metadata: {
        fetched: summary.fetched,
        created: summary.created,
        updated: summary.updated,
        skipped: summary.skipped,
        errors: summary.errors,
        dateStart: params.dateStart ?? null,
        dateEnd: params.dateEnd ?? null,
        timeZone,
      },
    })

    return summary
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Appointment sync failed'
    await recordSyncResult(practiceId, { status: 'error', error: message })
    throw error
  }
}
