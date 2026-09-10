/**
 * Canonical chart status stored on Patient.ehrActive.
 * FHIR Patient.active and Open Dental PatStatus both map here so automations
 * and the patient profile can treat every EHR/EMR the same.
 */
export function mapFhirPatientActive(
  patient: { active?: boolean } | null | undefined
): boolean | null {
  return typeof patient?.active === 'boolean' ? patient.active : null
}

const OPEN_DENTAL_INACTIVE_STATUSES = new Set([
  'inactive',
  'archived',
  'deleted',
  'deceased',
])

export function mapOpenDentalPatientActive(
  patStatus: string | null | undefined
): boolean | null {
  const status = typeof patStatus === 'string' ? patStatus.trim().toLowerCase() : ''
  if (!status) return null
  return !OPEN_DENTAL_INACTIVE_STATUSES.has(status)
}
