/**
 * Retell post-call fields collected when a caller updates dental insurance.
 * These keys are only present when the agent gathered insurance information.
 */

export const INSURANCE_INFO_UPDATE_FIELDS = [
  { key: 'policyHolderName', label: 'Insurance Policy Holder Name' },
  { key: 'policyHolderDob', label: 'Insurance Policy Holder DOB' },
  { key: 'dentalInsuranceProvider', label: 'Dental Insurance Provider' },
  { key: 'memberId', label: 'Insurance Member ID' },
  { key: 'groupNumber', label: 'Insurance Group Number' },
  { key: 'dentalInsurancePhoneNumber', label: 'Dental Insurance Phone Number' },
  { key: 'claimMailingAddress', label: 'Dental Insurance Claim Mailing Address' },
] as const

export type InsuranceInfoUpdateFieldKey = (typeof INSURANCE_INFO_UPDATE_FIELDS)[number]['key']

export type InsuranceInfoUpdateData = Partial<Record<InsuranceInfoUpdateFieldKey, string>>

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

/** Pull insurance-update fields from one or more Retell custom-analysis / metadata objects. */
export function extractInsuranceInfoUpdate(
  sources: Array<Record<string, unknown> | null | undefined>
): InsuranceInfoUpdateData | undefined {
  const records = sources
    .map((source) => asObject(source))
    .filter((record): record is Record<string, unknown> => Boolean(record))
  if (records.length === 0) return undefined

  const result: InsuranceInfoUpdateData = {}
  for (const field of INSURANCE_INFO_UPDATE_FIELDS) {
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

  return Object.keys(result).length > 0 ? result : undefined
}

/** Read insurance-update fields from a stored voice conversation metadata blob. */
export function readInsuranceInfoUpdateFromMetadata(
  metadata: unknown
): InsuranceInfoUpdateData | undefined {
  const meta = asObject(metadata)
  if (!meta) return undefined
  return extractInsuranceInfoUpdate([
    asObject(meta.insurance_info_update),
    asObject(meta.retell_custom_data),
    meta,
  ])
}

export function hasInsuranceInfoUpdateInMetadata(metadata: unknown): boolean {
  return Boolean(readInsuranceInfoUpdateFromMetadata(metadata))
}

/** Commlog lines using Retell's display labels, omitting empty fields. */
export function formatInsuranceInfoUpdateCommlogLines(data: InsuranceInfoUpdateData): string[] {
  const lines: string[] = []
  for (const field of INSURANCE_INFO_UPDATE_FIELDS) {
    const value = data[field.key]?.trim()
    if (value) lines.push(`${field.label}: ${value}`)
  }
  return lines
}
