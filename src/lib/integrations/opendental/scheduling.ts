import { prisma } from '@/lib/db'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import { getOpenDentalServices } from './factory'
import { logOpenDentalAudit } from './audit'
import { extractPatNumFromExternalId } from './commlogWriteback'
import { buildAppointmentExternalId, openDentalNaiveToInstant } from './appointmentSync'
import { resolveCreatedId } from './apiResponse'

const PATTERN_SLOT_MINUTES = 5
export const DEFAULT_SLOT_LENGTH_MINUTES = 30

export type OpenDentalProvider = {
  provNum: number
  name: string
  abbr: string | null
  isHidden: boolean
}

export type OpenDentalOperatory = {
  operatoryNum: number
  name: string
  isHidden: boolean
  provNum: number | null
}

export type OpenDentalOpenSlot = {
  /** Naive clinic-local start "yyyy-MM-dd HH:mm:ss" — sent back verbatim when booking. */
  start: string
  /** UTC instant (ISO) for the same wall-clock time in the practice timezone. */
  startUtc: string | null
  provNum: number
  opNum: number
  lengthMinutes: number
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length ? t : null
}

function num(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function isHidden(value: unknown): boolean {
  return String(value).toLowerCase() === 'true'
}

export async function listOpenDentalProviders(practiceId: string): Promise<OpenDentalProvider[]> {
  const services = await getOpenDentalServices(practiceId)
  const raw = (await services.providers.list()) as Array<Record<string, unknown>>
  if (!Array.isArray(raw)) return []
  return raw
    .map((p) => {
      const provNum = num(p.ProvNum)
      if (!provNum) return null
      const first = str(p.FName) ?? ''
      const last = str(p.LName) ?? ''
      const abbr = str(p.Abbr)
      const name = `${first} ${last}`.trim() || abbr || `Provider ${provNum}`
      return { provNum, name, abbr, isHidden: isHidden(p.IsHidden) }
    })
    .filter((p): p is OpenDentalProvider => p !== null)
}

export async function listOpenDentalOperatories(practiceId: string): Promise<OpenDentalOperatory[]> {
  const services = await getOpenDentalServices(practiceId)
  const raw = (await services.operatories.list()) as Array<Record<string, unknown>>
  if (!Array.isArray(raw)) return []
  return raw
    .map((o) => {
      const operatoryNum = num(o.OperatoryNum)
      if (!operatoryNum) return null
      const name = str(o.OpName) ?? `Operatory ${operatoryNum}`
      return {
        operatoryNum,
        name,
        isHidden: isHidden(o.IsHidden),
        provNum: num(o.ProvDentist) || null,
      }
    })
    .filter((o): o is OpenDentalOperatory => o !== null)
}

type NaiveParts = { y: number; mo: number; d: number; h: number; mi: number; s: number }

function parseNaive(value: unknown): NaiveParts | null {
  const raw = str(value)
  if (!raw) return null
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  return {
    y: Number(m[1]),
    mo: Number(m[2]),
    d: Number(m[3]),
    h: Number(m[4]),
    mi: Number(m[5]),
    s: Number(m[6] ?? '0'),
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatNaive(p: NaiveParts): string {
  return `${p.y}-${pad(p.mo)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`
}

/** Wall-clock arithmetic only: treat the naive parts as UTC, add minutes, read back. */
function addMinutesNaive(p: NaiveParts, minutes: number): NaiveParts {
  const base = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)
  const next = new Date(base + minutes * 60_000)
  return {
    y: next.getUTCFullYear(),
    mo: next.getUTCMonth() + 1,
    d: next.getUTCDate(),
    h: next.getUTCHours(),
    mi: next.getUTCMinutes(),
    s: next.getUTCSeconds(),
  }
}

function diffMinutesNaive(start: NaiveParts, end: NaiveParts): number {
  const a = Date.UTC(start.y, start.mo - 1, start.d, start.h, start.mi, start.s)
  const b = Date.UTC(end.y, end.mo - 1, end.d, end.h, end.mi, end.s)
  return Math.round((b - a) / 60_000)
}

/**
 * Fetch open scheduling windows from Open Dental and subdivide them into discrete,
 * bookable start times of `lengthMinutes` each. Open Dental returns whole open ranges,
 * not appointment-sized slots, so we slice them here.
 */
export async function getOpenDentalOpenSlots(params: {
  practiceId: string
  provNum?: number | null
  opNum?: number | null
  dateStart: string
  dateEnd?: string
  lengthMinutes?: number | null
}): Promise<OpenDentalOpenSlot[]> {
  const { practiceId, provNum, opNum, dateStart, dateEnd } = params
  const lengthMinutes = params.lengthMinutes && params.lengthMinutes > 0
    ? params.lengthMinutes
    : DEFAULT_SLOT_LENGTH_MINUTES

  const services = await getOpenDentalServices(practiceId)
  const timeZone = await getPracticeTimeZone(practiceId)

  const query: Record<string, string | number> = {
    dateStart,
    dateEnd: dateEnd ?? dateStart,
    lengthMinutes,
  }
  if (provNum) query.ProvNum = provNum
  if (opNum) query.OpNum = opNum

  const ranges = (await services.appointments.getSlots(query)) as Array<Record<string, unknown>>
  if (!Array.isArray(ranges)) return []

  const slots: OpenDentalOpenSlot[] = []
  for (const range of ranges) {
    const start = parseNaive(range.DateTimeStart)
    const end = parseNaive(range.DateTimeEnd)
    const rProv = num(range.ProvNum) ?? provNum ?? 0
    const rOp = num(range.OpNum) ?? opNum ?? 0
    if (!start || !end) continue

    const windowMinutes = diffMinutesNaive(start, end)
    let cursor = start
    let offset = 0
    while (offset + lengthMinutes <= windowMinutes) {
      const naive = formatNaive(cursor)
      slots.push({
        start: naive,
        startUtc: openDentalNaiveToInstant(naive, timeZone)?.toISOString() ?? null,
        provNum: rProv,
        opNum: rOp,
        lengthMinutes,
      })
      cursor = addMinutesNaive(cursor, lengthMinutes)
      offset += lengthMinutes
    }
  }

  slots.sort((a, b) => a.start.localeCompare(b.start))
  return slots
}

function lengthToPattern(lengthMinutes: number): string {
  const slots = Math.max(1, Math.round(lengthMinutes / PATTERN_SLOT_MINUTES))
  return 'X'.repeat(slots)
}

export type OpenDentalBookingResult = {
  appointmentId: string
  aptNum: number
  startTime: Date
  endTime: Date
}

/**
 * Book an appointment directly into Open Dental for an OD-linked patient and create the
 * mirrored CRM appointment (linked via `calBookingId = opendental:apt:{AptNum}`).
 */
export async function bookOpenDentalAppointment(params: {
  practiceId: string
  patientId: string
  provNum?: number | null
  opNum: number
  /** Naive clinic-local "yyyy-MM-dd HH:mm:ss" (as returned by getOpenDentalOpenSlots). */
  dateTimeStart: string
  lengthMinutes?: number | null
  note?: string | null
  visitType?: string | null
  actorUserId?: string
}): Promise<OpenDentalBookingResult> {
  const { practiceId, patientId, provNum, opNum, dateTimeStart, note, visitType, actorUserId } = params
  const lengthMinutes = params.lengthMinutes && params.lengthMinutes > 0
    ? params.lengthMinutes
    : DEFAULT_SLOT_LENGTH_MINUTES

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, practiceId },
    select: { id: true, externalEhrId: true },
  })
  if (!patient) throw new Error('Patient not found')

  const patNum = extractPatNumFromExternalId(patient.externalEhrId)
  if (!patNum) throw new Error('Patient is not linked to Open Dental')

  if (!parseNaive(dateTimeStart)) throw new Error('Invalid appointment start time')
  if (!opNum || opNum <= 0) throw new Error('An operatory is required to book in Open Dental')

  const services = await getOpenDentalServices(practiceId)
  const timeZone = await getPracticeTimeZone(practiceId)

  const body: Record<string, unknown> = {
    PatNum: patNum,
    Op: opNum,
    AptDateTime: dateTimeStart,
    Pattern: lengthToPattern(lengthMinutes),
    AptStatus: 'Scheduled',
  }
  if (provNum) body.ProvNum = provNum
  if (note) body.Note = note

  const created = await services.appointments.create(body)
  const aptNum = resolveCreatedId(created, 'AptNum')
  if (!aptNum || aptNum <= 0) {
    throw new Error('Open Dental did not return an appointment number')
  }

  const start = openDentalNaiveToInstant(dateTimeStart, timeZone)
  if (!start) throw new Error('Failed to resolve appointment start instant')
  const end = new Date(start.getTime() + lengthMinutes * 60_000)

  // Upsert by the Open Dental link so a concurrent sync/pull that already mirrored
  // this appointment doesn't trigger a unique-constraint failure on calBookingId.
  const externalKey = buildAppointmentExternalId(aptNum)
  const appointment = await prisma.appointment.upsert({
    where: { calBookingId: externalKey },
    create: {
      practiceId,
      patientId,
      providerId: provNum ? `prov:${provNum}` : null,
      status: 'scheduled',
      startTime: start,
      endTime: end,
      timezone: timeZone,
      visitType: visitType?.trim() || 'Open Dental Appointment',
      reason: note?.trim() || null,
      notes: note?.trim() || null,
      calBookingId: externalKey,
      calEventId: 'opendental',
    },
    update: {
      patientId,
      providerId: provNum ? `prov:${provNum}` : null,
      status: 'scheduled',
      startTime: start,
      endTime: end,
      timezone: timeZone,
      visitType: visitType?.trim() || 'Open Dental Appointment',
      reason: note?.trim() || null,
      notes: note?.trim() || null,
    },
  })

  await logOpenDentalAudit({
    tenantId: practiceId,
    actorUserId,
    action: 'appointment.booked',
    entity: 'Appointment',
    entityId: String(aptNum),
    metadata: { appointmentId: appointment.id, dateTimeStart, opNum, provNum, lengthMinutes, timeZone },
  })

  return { appointmentId: appointment.id, aptNum, startTime: start, endTime: end }
}
