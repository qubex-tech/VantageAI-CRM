/**
 * Retell post-call fields collected when a caller updates medical history,
 * medications, and/or allergies. Leave blank in Retell when not discussed.
 */

export const MEDICAL_HISTORY_UPDATE_FIELDS = [
  { key: 'medications', label: 'Updated Medications' },
  { key: 'medicalHistory', label: 'Updated Medical History' },
  { key: 'allergies', label: 'Updated Allergies' },
] as const

export type MedicalHistoryUpdateFieldKey = (typeof MEDICAL_HISTORY_UPDATE_FIELDS)[number]['key']

export type MedicalHistoryUpdateData = Partial<Record<MedicalHistoryUpdateFieldKey, string>>

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

/** Pull medical-history update fields from one or more Retell custom-analysis objects. */
export function extractMedicalHistoryUpdate(
  sources: Array<Record<string, unknown> | null | undefined>
): MedicalHistoryUpdateData | undefined {
  const records = sources
    .map((source) => asObject(source))
    .filter((record): record is Record<string, unknown> => Boolean(record))
  if (records.length === 0) return undefined

  const result: MedicalHistoryUpdateData = {}
  for (const field of MEDICAL_HISTORY_UPDATE_FIELDS) {
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

/** Read medical-history update fields from a stored voice conversation metadata blob. */
export function readMedicalHistoryUpdateFromMetadata(
  metadata: unknown
): MedicalHistoryUpdateData | undefined {
  const meta = asObject(metadata)
  if (!meta) return undefined
  return extractMedicalHistoryUpdate([
    asObject(meta.medical_history_update),
    asObject(meta.retell_custom_data),
    meta,
  ])
}

export function hasMedicalHistoryUpdateInMetadata(metadata: unknown): boolean {
  return Boolean(readMedicalHistoryUpdateFromMetadata(metadata))
}

/** Commlog lines using Retell's display labels, omitting empty / not-discussed fields. */
export function formatMedicalHistoryUpdateCommlogLines(data: MedicalHistoryUpdateData): string[] {
  const lines: string[] = []
  for (const field of MEDICAL_HISTORY_UPDATE_FIELDS) {
    const value = data[field.key]?.trim()
    if (value) lines.push(`${field.label}: ${value}`)
  }
  return lines
}
