import crypto from 'crypto'
import type { NexhealthAppointment, NexhealthPatient } from './types'

/** Namespace prefix so NexHealth patient ids never collide with FHIR or Open Dental charts. */
export const NEXHEALTH_PATIENT_PREFIX = 'nexhealth:'
export const NEXHEALTH_APPOINTMENT_PREFIX = 'nexhealth:apt:'
export const NEXHEALTH_PROVIDER_PREFIX = 'nexhealth:prov:'

const APPOINTMENT_LOOKBACK_DAYS = 7
const APPOINTMENT_LOOKAHEAD_DAYS = 60
const UPDATED_SINCE_OVERLAP_MS = 24 * 60 * 60 * 1000

export function buildNexhealthPatientExternalId(id: number | string): string {
  return `${NEXHEALTH_PATIENT_PREFIX}${id}`
}

export function buildNexhealthAppointmentExternalId(id: number | string): string {
  return `${NEXHEALTH_APPOINTMENT_PREFIX}${id}`
}

export function buildNexhealthProviderId(id: number | string): string {
  return `${NEXHEALTH_PROVIDER_PREFIX}${id}`
}

export function parseNexhealthPatientId(externalEhrId: string | null | undefined): number | null {
  if (!externalEhrId?.startsWith(NEXHEALTH_PATIENT_PREFIX)) return null
  if (
    externalEhrId.startsWith(NEXHEALTH_APPOINTMENT_PREFIX) ||
    externalEhrId.startsWith(NEXHEALTH_PROVIDER_PREFIX)
  ) {
    return null
  }
  const n = Number(externalEhrId.slice(NEXHEALTH_PATIENT_PREFIX.length))
  return Number.isInteger(n) && n > 0 ? n : null
}

export function parseNexhealthAppointmentId(calBookingId: string | null | undefined): number | null {
  if (!calBookingId?.startsWith(NEXHEALTH_APPOINTMENT_PREFIX)) return null
  const n = Number(calBookingId.slice(NEXHEALTH_APPOINTMENT_PREFIX.length))
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * NexHealth placeholder charts (foreign id ending in `np`) cannot be booked and
 * are merged into the real patient once the EHR chart exists.
 */
export function isNexhealthPlaceholderPatient(patient: { foreign_id?: string | null }): boolean {
  const foreignId = (patient.foreign_id ?? '').trim().toLowerCase()
  return foreignId.endsWith('np')
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export function parseNexhealthDate(value: unknown): Date | null {
  const raw = cleanString(value)
  if (!raw || raw.startsWith('0001-01-01')) return null
  const datePart = raw.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null
  const parsed = new Date(`${datePart}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatNexhealthDate(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) return null
  return value.toISOString().slice(0, 10)
}

function normalizeGender(value: unknown): string | null {
  const raw = cleanString(value)?.toLowerCase()
  if (!raw) return null
  if (raw.startsWith('m')) return 'male'
  if (raw.startsWith('f')) return 'female'
  if (raw === 'unknown') return 'unknown'
  return 'other'
}

function phonesFromPatient(patient: NexhealthPatient): string[] {
  const bio = patient.bio
  const ordered = [
    bio?.cell_phone_number,
    bio?.phone_number,
    patient.phone_number,
    bio?.home_phone_number,
    bio?.work_phone_number,
  ]
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of ordered) {
    const phone = cleanString(value)
    if (!phone || seen.has(phone)) continue
    seen.add(phone)
    out.push(phone)
  }
  return out
}

export type MappedNexhealthPatient = {
  externalEhrId: string
  name: string
  firstName: string | null
  lastName: string | null
  dateOfBirth: Date | null
  gender: string | null
  primaryPhone: string | null
  secondaryPhone: string | null
  email: string | null
  addressLine1: string | null
  addressLine2: string | null
  address: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  preferredContactMethod: string
  ehrActive: boolean | null
}

export function mapNexhealthPatient(patient: NexhealthPatient): MappedNexhealthPatient {
  const firstName = cleanString(patient.first_name)
  const lastName = cleanString(patient.last_name)
  const middle = cleanString(patient.middle_name)
  const name =
    cleanString(patient.name) ||
    [firstName, middle, lastName].filter(Boolean).join(' ').trim() ||
    `NexHealth Patient ${patient.id}`
  const phones = phonesFromPatient(patient)
  const email = cleanString(patient.email)
  const addressLine1 = cleanString(patient.bio?.address_line_1)
  const addressLine2 = cleanString(patient.bio?.address_line_2)
  const city = cleanString(patient.bio?.city)
  const state = cleanString(patient.bio?.state)
  const postalCode = cleanString(patient.bio?.zip_code)
  const address =
    [addressLine1, addressLine2, [city, state].filter(Boolean).join(', '), postalCode]
      .filter(Boolean)
      .join(', ') || null

  return {
    externalEhrId: buildNexhealthPatientExternalId(patient.id),
    name,
    firstName,
    lastName,
    dateOfBirth: parseNexhealthDate(patient.bio?.date_of_birth),
    gender: normalizeGender(patient.bio?.gender),
    primaryPhone: phones[0] ?? null,
    secondaryPhone: phones[1] ?? null,
    email,
    addressLine1,
    addressLine2,
    address,
    city,
    state,
    postalCode,
    preferredContactMethod: phones[0] ? 'phone' : email ? 'email' : 'phone',
    ehrActive: patient.inactive === true ? false : patient.inactive === false ? true : null,
  }
}

/**
 * Unlinked CRM merge filters. Phone alone is never enough — family members share numbers.
 */
export function buildNexhealthPatientMergeFilters(mapped: {
  email: string | null
  name: string
  dateOfBirth: Date | null
  primaryPhone: string | null
}): Array<Record<string, unknown>> {
  const filters: Array<Record<string, unknown>> = []
  if (mapped.email) {
    filters.push({ email: { equals: mapped.email, mode: 'insensitive' } })
  }
  if (mapped.name && mapped.dateOfBirth) {
    filters.push({
      AND: [
        { name: { equals: mapped.name, mode: 'insensitive' } },
        { dateOfBirth: mapped.dateOfBirth },
      ],
    })
  }
  if (mapped.primaryPhone && mapped.name && mapped.dateOfBirth) {
    filters.push({
      AND: [
        { OR: [{ primaryPhone: mapped.primaryPhone }, { phone: mapped.primaryPhone }] },
        { name: { equals: mapped.name, mode: 'insensitive' } },
        { dateOfBirth: mapped.dateOfBirth },
      ],
    })
  }
  return filters
}

export function mapNexhealthAppointmentStatus(appointment: {
  cancelled?: boolean | null
  patient_missed?: boolean | null
  checked_out?: boolean | null
  is_past?: boolean | null
  confirmed?: boolean | null
}): string {
  if (appointment.cancelled) return 'cancelled'
  if (appointment.patient_missed) return 'no_show'
  if (appointment.checked_out || appointment.is_past) return 'completed'
  if (appointment.confirmed) return 'confirmed'
  return 'scheduled'
}

export function nexhealthVisitType(appointment: NexhealthAppointment): string {
  return cleanString(appointment.appointment_type?.name) || 'NexHealth Appointment'
}

export function nexhealthAppointmentWindow(now = new Date()): { start: string; end: string } {
  const start = new Date(now.getTime() - APPOINTMENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const end = new Date(now.getTime() + APPOINTMENT_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

/** One-day overlap so a sync that starts mid-write does not miss the previous page. */
export function nexhealthUpdatedSince(lastSuccessfulSyncAt: Date | null | undefined): string | null {
  if (!lastSuccessfulSyncAt) return null
  return new Date(lastSuccessfulSyncAt.getTime() - UPDATED_SINCE_OVERLAP_MS).toISOString()
}

export function nexhealthSlotWindows(
  dateFrom: string,
  dateTo: string,
  maxDays = 14
): Array<{ startDate: string; days: number }> {
  const start = dateFrom.slice(0, 10)
  const end = (dateTo || dateFrom).slice(0, 10)
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T00:00:00Z`)
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return [{ startDate: start, days: 1 }]
  }
  const totalDays = Math.floor((endMs - startMs) / 86_400_000) + 1
  const windows: Array<{ startDate: string; days: number }> = []
  let cursor = startMs
  let remaining = totalDays
  const step = Math.max(1, maxDays)
  while (remaining > 0) {
    const days = Math.min(step, remaining)
    windows.push({ startDate: new Date(cursor).toISOString().slice(0, 10), days })
    cursor += days * 86_400_000
    remaining -= days
  }
  return windows
}

/**
 * NexHealth signs `timestamp + "." + base64(raw body)` with HMAC-SHA256 (hex).
 * The body must be the exact bytes received — do not re-serialize JSON first.
 */
export function verifyNexhealthWebhookSignature(params: {
  rawBody: string
  timestamp: string
  signature: string
  secret: string
}): boolean {
  const { rawBody, timestamp, signature, secret } = params
  if (!rawBody || !timestamp || !signature || !secret) return false
  const encoded = Buffer.from(rawBody, 'utf8').toString('base64')
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${encoded}`)
    .digest('hex')
    .toLowerCase()
  const actual = signature.trim().toLowerCase()
  if (actual.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}
