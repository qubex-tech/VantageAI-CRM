import { prisma } from '@/lib/db'
import {
  createEhrClientForPractice,
  sanitizeEcwFhirRequestPath,
} from '@/lib/integrations/ehr/scheduleSync'
import { syncOpenDentalAppointmentsForPatient } from '@/lib/integrations/opendental/appointmentSync'

/** Appointment statuses treated as an active future booking for automation conditions. */
export const FUTURE_SCHEDULED_APPOINTMENT_STATUS = 'scheduled' as const

export const DEFAULT_SCHEDULED_APPOINTMENT_LOOKAHEAD_DAYS = 60
export const MAX_SCHEDULED_APPOINTMENT_LOOKAHEAD_DAYS = 365

const ECW_LOOKAHEAD_TIMEOUT_MS = 60_000
const UPCOMING_ENCOUNTER_STATUSES = new Set([
  'planned',
  'arrived',
  'triaged',
  'in-progress',
])

type FhirEncounter = {
  id?: string
  status?: string
  period?: { start?: string; end?: string }
}

type FhirBundle = {
  entry?: Array<{ resource?: FhirEncounter }>
  link?: Array<{ relation?: string; url?: string }>
}

export function parseScheduledAppointmentLookaheadDays(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n)) return undefined
  const days = Math.floor(n)
  if (days < 1) return undefined
  return Math.min(days, MAX_SCHEDULED_APPOINTMENT_LOOKAHEAD_DAYS)
}

/** Walk automation condition JSON and return the look-ahead used by this rule. */
export function extractScheduledAppointmentLookahead(conditionsJson: unknown): {
  used: boolean
  withinDays?: number
} {
  let used = false
  let unbounded = false
  let maxDays: number | undefined

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const rec = node as Record<string, unknown>
    if (rec.field === 'patient.hasFutureScheduledAppointment') {
      used = true
      const days = parseScheduledAppointmentLookaheadDays(rec.withinDays)
      if (days == null) unbounded = true
      else maxDays = maxDays == null ? days : Math.max(maxDays, days)
    }
    if (Array.isArray(rec.conditions)) rec.conditions.forEach(walk)
  }
  walk(conditionsJson)
  return { used, withinDays: unbounded ? undefined : maxDays }
}

export function appointmentWindowEnd(now: Date, withinDays?: number): Date | undefined {
  if (withinDays == null) return undefined
  return new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000)
}

export function buildFutureScheduledAppointmentWhere(
  practiceId: string,
  patientId: string,
  now: Date = new Date(),
  until?: Date
) {
  return {
    practiceId,
    patientId,
    status: FUTURE_SCHEDULED_APPOINTMENT_STATUS,
    startTime: until ? { gt: now, lte: until } : { gt: now },
  }
}

function chicagoYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function addUtcCalendarDay(ymd: string): string {
  const date = new Date(`${ymd}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

export function encounterCountsAsUpcomingScheduled(params: {
  status?: string
  start?: string | null
  now: Date
  until?: Date
}): boolean {
  const start = params.start ? new Date(params.start) : null
  if (!start || Number.isNaN(start.getTime()) || start.getTime() <= params.now.getTime()) {
    return false
  }
  if (params.until && start.getTime() > params.until.getTime()) return false
  const status = (params.status || 'planned').toLowerCase()
  if (status === 'cancelled' || status === 'finished' || status === 'entered-in-error') {
    return false
  }
  return UPCOMING_ENCOUNTER_STATUSES.has(status) || status === 'unknown' || status === 'planned'
}

async function crmHasUpcomingScheduledAppointment(params: {
  practiceId: string
  patientId: string
  now: Date
  until?: Date
}): Promise<boolean> {
  const existing = await prisma.appointment.findFirst({
    where: buildFutureScheduledAppointmentWhere(
      params.practiceId,
      params.patientId,
      params.now,
      params.until
    ),
    select: { id: true },
  })
  return Boolean(existing)
}

async function fetchEncounterPages(
  client: { request: <T>(path: string) => Promise<T> },
  initialPath: string
): Promise<FhirEncounter[]> {
  const encounters: FhirEncounter[] = []
  let nextPath: string | undefined = sanitizeEcwFhirRequestPath(initialPath)
  const seen = new Set<string>()
  for (let i = 0; i < 20 && nextPath; i++) {
    if (seen.has(nextPath)) break
    seen.add(nextPath)
    const bundle = (await client.request(nextPath)) as FhirBundle
    for (const entry of bundle.entry || []) {
      if (entry.resource?.id) encounters.push(entry.resource)
    }
    const nextLink = bundle.link?.find((link) => link.relation === 'next')?.url
    nextPath = nextLink ? sanitizeEcwFhirRequestPath(nextLink) : undefined
  }
  return encounters
}

async function hasEcwUpcomingEncounter(params: {
  practiceId: string
  externalEhrId: string
  now: Date
  until?: Date
}): Promise<boolean> {
  const ehr = await createEhrClientForPractice(params.practiceId, {
    timeoutMs: ECW_LOOKAHEAD_TIMEOUT_MS,
  })
  if (!ehr) return false

  const startDay = chicagoYmd(params.now)
  const encoded = encodeURIComponent(params.externalEhrId)
  const path = params.until
    ? `/Encounter?patient=${encoded}&date=ge${startDay}&date=lt${addUtcCalendarDay(chicagoYmd(params.until))}`
    : `/Encounter?patient=${encoded}`

  const encounters = await fetchEncounterPages(ehr.client, path)
  return encounters.some((encounter) =>
    encounterCountsAsUpcomingScheduled({
      status: encounter.status,
      start: encounter.period?.start,
      now: params.now,
      until: params.until,
    })
  )
}

/**
 * True when the patient has at least one future appointment with status scheduled.
 * Optional `withinDays` limits the window (e.g. 60). After a CRM miss, checks eCW
 * Encounter or live-pulls Open Dental so recently rebooked visits are not missed.
 */
export async function patientHasFutureScheduledAppointment(params: {
  practiceId: string
  patientId: string
  now?: Date
  withinDays?: number
}): Promise<boolean> {
  const now = params.now ?? new Date()
  const until = appointmentWindowEnd(now, params.withinDays)

  if (await crmHasUpcomingScheduledAppointment({ ...params, now, until })) {
    return true
  }

  const patient = await prisma.patient.findFirst({
    where: { id: params.patientId, practiceId: params.practiceId, deletedAt: null },
    select: { externalEhrId: true },
  })
  const externalEhrId = patient?.externalEhrId?.trim()
  if (!externalEhrId) return false

  try {
    if (externalEhrId.startsWith('opendental:')) {
      await syncOpenDentalAppointmentsForPatient({
        practiceId: params.practiceId,
        patientId: params.patientId,
        externalEhrId,
      })
      return crmHasUpcomingScheduledAppointment({ ...params, now, until })
    }

    return await hasEcwUpcomingEncounter({
      practiceId: params.practiceId,
      externalEhrId,
      now,
      until,
    })
  } catch (error) {
    console.warn('[automation] upcoming-appointment EHR check failed', {
      practiceId: params.practiceId,
      patientId: params.patientId,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}
