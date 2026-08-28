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

export type SplitPersonName = {
  firstName: string | null
  lastName: string | null
}

/**
 * Split a person display string into first/last.
 * Handles eCW Coverage.subscriber.display ("LAST, FIRST") and "First Last".
 */
export function splitPersonDisplayName(raw: string | null | undefined): SplitPersonName {
  const text = raw?.trim()
  if (!text) return { firstName: null, lastName: null }

  if (text.includes(',')) {
    const [lastRaw, restRaw = ''] = text.split(',')
    const last = lastRaw.trim() || null
    const first = restRaw.trim().split(/\s+/).filter(Boolean)[0] || null
    return { firstName: first, lastName: last }
  }

  const parts = text.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { firstName: parts[0], lastName: null }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

/** Prefer structured given/family; fall back to display text. */
export function namesFromFhirHumanName(name?: FhirHumanName | null): SplitPersonName {
  if (!name) return { firstName: null, lastName: null }
  const given = (name.given || []).map((part) => part?.trim()).filter(Boolean)
  const family = name.family?.trim() || ''
  if (given.length || family) {
    return { firstName: given[0] || null, lastName: family || null }
  }
  return splitPersonDisplayName(name.text)
}
