export type FhirIdentifier = {
  use?: string
  system?: string
  value?: string
}

export type FhirPatientIdentifiers = {
  id?: string
  identifier?: FhirIdentifier[] | null
}

/**
 * eCW secondary account / MRN from Patient.identifier (use=secondary).
 * Ignores the usual identifier, which is typically the opaque FHIR Patient.id.
 */
export function extractEcwSecondaryMrn(
  patient: FhirPatientIdentifiers | null | undefined
): string | null {
  if (!patient) return null
  const identifiers = Array.isArray(patient.identifier) ? patient.identifier : []
  const fhirId = patient.id?.trim() || ''
  for (const ident of identifiers) {
    if (ident?.use !== 'secondary') continue
    const value = ident.value?.trim()
    if (!value) continue
    if (fhirId && value === fhirId) continue
    return value
  }
  return null
}
