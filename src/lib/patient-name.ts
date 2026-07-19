/**
 * Canonical patient display names: First Last.
 * eCW FHIR often puts "Last First" in HumanName.text while given/family are correct.
 */

export type PatientNameFields = {
  name?: string | null
  firstName?: string | null
  lastName?: string | null
}

export type FhirHumanName = {
  text?: string
  family?: string
  given?: string[]
}

/** Prefer structured First Last; fall back to legacy `name`. */
export function formatPatientDisplayName(patient: PatientNameFields): string {
  const fromParts = [patient.firstName?.trim(), patient.lastName?.trim()]
    .filter(Boolean)
    .join(' ')
  if (fromParts) return fromParts
  return (patient.name || '').trim()
}

/**
 * Build First Last from FHIR HumanName.
 * Prefer given+family over name.text — eCW frequently sends Last First in text.
 */
export function formatFhirHumanName(name?: FhirHumanName | null): string | null {
  if (!name) return null
  const given = (name.given || []).map((part) => part?.trim()).filter(Boolean)
  const family = name.family?.trim() || ''
  const fromParts = [...given, family].filter(Boolean).join(' ').trim()
  if (fromParts) return fromParts
  const text = name.text?.trim()
  return text || null
}

export function formatFhirPatientDisplayName(patient: {
  name?: FhirHumanName[] | null
}): string | null {
  return formatFhirHumanName(patient.name?.[0])
}
