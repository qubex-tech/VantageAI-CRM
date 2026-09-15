/**
 * Retell post-call fields when a caller requests records/x-rays
 * emailed to themselves or sent to another dental office.
 */

export const RECORDS_REQUEST_STRING_FIELDS = [
  { key: 'dentalOfficeName', label: 'Records Request - Dental Office Name' },
  { key: 'dentalOfficePhoneNumber', label: 'Records Request - Dental Office Phone Number' },
  { key: 'dentalOfficeEmail', label: 'Records Request - Dental Office Email' },
  {
    key: 'nextAppointmentDate',
    label: 'Records Request - Next Appointment Date With Other Dental Office',
  },
] as const

export const RECORDS_REQUEST_EMAIL_TO_PATIENT_LABEL = 'Records Request - Email To Patient'
export const RECORDS_REQUEST_EMAIL_TO_PATIENT_KEY = 'emailToPatient'

export type RecordsRequestStringFieldKey = (typeof RECORDS_REQUEST_STRING_FIELDS)[number]['key']

export type RecordsRequestData = Partial<Record<RecordsRequestStringFieldKey, string>> & {
  emailToPatient?: boolean
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function normalizeRetellKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeRetellRecord(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    const normalized = normalizeRetellKey(key)
    if (!normalized) continue
    output[normalized] = value
  }
  return output
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text.length > 0) return text
  }
  return undefined
}

function parseBooleanLike(value: unknown): boolean | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return undefined
  if (['true', 'yes', 'y', '1'].includes(normalized)) return true
  if (['false', 'no', 'n', '0'].includes(normalized)) return false
  return undefined
}

function firstBooleanLike(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    const parsed = parseBooleanLike(value)
    if (parsed !== undefined) return parsed
  }
  return undefined
}

function readEmailToPatient(record: Record<string, unknown>): boolean | undefined {
  const normalized = normalizeRetellRecord(record)
  return firstBooleanLike(
    record[RECORDS_REQUEST_EMAIL_TO_PATIENT_LABEL],
    record[RECORDS_REQUEST_EMAIL_TO_PATIENT_KEY],
    normalized[normalizeRetellKey(RECORDS_REQUEST_EMAIL_TO_PATIENT_LABEL)],
    normalized[normalizeRetellKey(RECORDS_REQUEST_EMAIL_TO_PATIENT_KEY)]
  )
}

/** Pull records-request fields from one or more Retell custom-analysis objects. */
export function extractRecordsRequest(
  sources: Array<Record<string, unknown> | null | undefined>
): RecordsRequestData | undefined {
  const records = sources
    .map((source) => asObject(source))
    .filter((record): record is Record<string, unknown> => Boolean(record))
  if (records.length === 0) return undefined

  const result: RecordsRequestData = {}

  for (const record of records) {
    const parsed = readEmailToPatient(record)
    if (parsed !== undefined) {
      result.emailToPatient = parsed
      break
    }
  }

  for (const field of RECORDS_REQUEST_STRING_FIELDS) {
    const normalizedLabel = normalizeRetellKey(field.label)
    let value: string | undefined
    for (const record of records) {
      const normalized = normalizeRetellRecord(record)
      value = firstNonEmptyString(
        record[field.label],
        record[field.key],
        normalized[normalizedLabel],
        normalized[normalizeRetellKey(field.key)]
      )
      if (value) break
    }
    if (value) result[field.key] = value
  }

  const hasOfficeDestination = RECORDS_REQUEST_STRING_FIELDS.some((field) =>
    Boolean(result[field.key])
  )
  if (result.emailToPatient !== true && !hasOfficeDestination) return undefined

  if (result.emailToPatient !== true) delete result.emailToPatient
  return result
}

export function readRecordsRequestFromMetadata(metadata: unknown): RecordsRequestData | undefined {
  const meta = asObject(metadata)
  if (!meta) return undefined
  return extractRecordsRequest([
    asObject(meta.records_request),
    asObject(meta.retell_custom_data),
    meta,
  ])
}

export function hasRecordsRequestToPatientInMetadata(metadata: unknown): boolean {
  return readRecordsRequestFromMetadata(metadata)?.emailToPatient === true
}

export function hasRecordsRequestToOtherOfficeInMetadata(metadata: unknown): boolean {
  const data = readRecordsRequestFromMetadata(metadata)
  if (!data) return false
  return RECORDS_REQUEST_STRING_FIELDS.some((field) => Boolean(data[field.key]))
}

/** Commlog lines using Retell's display labels. Email-to-patient only when true. */
export function formatRecordsRequestCommlogLines(data: RecordsRequestData): string[] {
  const lines: string[] = []
  if (data.emailToPatient === true) {
    lines.push(`${RECORDS_REQUEST_EMAIL_TO_PATIENT_LABEL}: Yes`)
  }
  for (const field of RECORDS_REQUEST_STRING_FIELDS) {
    const value = data[field.key]?.trim()
    if (value) lines.push(`${field.label}: ${value}`)
  }
  return lines
}
