import { prisma } from '@/lib/db'
import type { Appointment as OdAppointment } from '@vantage/opendental-sdk'
import { getOpenDentalServices } from './factory'
import { recordSyncResult } from './connectionManager'
import { logOpenDentalAudit } from './audit'
import { ensureCrmPatientIdForPatNum } from './patientSync'

/** Open Dental returns naive local datetimes; we preserve the wall-clock numbers as UTC. */
const OD_APPOINTMENT_TIMEZONE = 'UTC'
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

/** Parse "YYYY-MM-DD HH:mm:ss" preserving wall-clock numbers (stored as UTC). */
function parseOdDateTime(value: unknown): Date | null {
  const raw = cleanString(value)
  if (!raw) return null
  if (raw.startsWith('0001-01-01')) return null
  const isoish = `${raw.replace(' ', 'T')}Z`
  const parsed = new Date(isoish)
  if (Number.isNaN(parsed.getTime())) return null
  if (parsed.getUTCFullYear() < 1900) return null
  return parsed
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
}): Promise<UpsertOutcome> {
  const { practiceId, patientId, od } = params

  const start = parseOdDateTime(od.AptDateTime)
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
    timezone: OD_APPOINTMENT_TIMEZONE,
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
}): Promise<AppointmentSyncSummary> {
  const { practiceId, actorUserId } = params
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 100)
  const maxPages = Math.min(Math.max(params.maxPages ?? 200, 1), 1000)

  const services = await getOpenDentalServices(practiceId)
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
          if (!isSchedulableStatus(od.AptStatus) || !parseOdDateTime(od.AptDateTime)) {
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

          const outcome = await upsertAppointmentFromOpenDental({ practiceId, patientId, od })
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
      },
    })

    return summary
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Appointment sync failed'
    await recordSyncResult(practiceId, { status: 'error', error: message })
    throw error
  }
}
