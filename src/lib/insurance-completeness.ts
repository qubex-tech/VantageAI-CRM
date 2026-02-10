/**
 * Deterministic completeness for insurance policies (eligibility/verification readiness).
 * Used for badge display and missing-fields list; does NOT run eligibility checks.
 */

export type InsuranceCompletenessStatus = 'ready' | 'missing_info'

export interface InsuranceCompletenessResult {
  status: InsuranceCompletenessStatus
  missingFields: string[]
  warnings: string[] // Non-blocking recommendations (e.g. address, ZIP)
}

type Policy = {
  payerNameRaw: string
  memberId: string
  subscriberIsPatient: boolean
  subscriberFirstName?: string | null
  subscriberLastName?: string | null
  subscriberDob?: Date | string | null
  relationshipToPatient?: string | null
  bcbsAlphaPrefix?: string | null
}

type Patient = {
  firstName?: string | null
  lastName?: string | null
  dateOfBirth?: Date | string | null
  addressLine1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
}

const ZIP_REGEX = /^\d{5}(-\d{4})?$/

function isBcbsPayer(payerName: string): boolean {
  const n = (payerName || '').toUpperCase()
  return n.includes('BCBS') || n.includes('BLUE CROSS')
}

/** Derive BCBS alpha prefix from first 3 chars of member ID if they are letters. */
export function deriveBcbsAlphaPrefix(memberId: string): string | null {
  if (!memberId || memberId.length < 3) return null
  const prefix = memberId.substring(0, 3)
  if (/^[A-Za-z]+$/.test(prefix)) return prefix
  return null
}

/**
 * Compute completeness for a single policy.
 * ✅ Ready requires: payer name, member ID, patient first/last/DOB (on profile),
 *   and if subscriber != patient: subscriber first/last/DOB + relationship.
 * For BCBS: alpha prefix required (derived automatically if possible); if cannot derive, add to missing_fields.
 */
export function computeInsuranceCompleteness(
  policy: Policy,
  patient: Patient
): InsuranceCompletenessResult {
  const missingFields: string[] = []
  const warnings: string[] = []

  // Required: Payer name
  if (!policy.payerNameRaw?.trim()) {
    missingFields.push('Payer name')
  }

  // Required: Member ID
  if (!policy.memberId?.trim()) {
    missingFields.push('Member ID')
  }

  // Patient name/DOB (on profile) - required for verification
  if (!patient.firstName?.trim()) missingFields.push('Patient first name')
  if (!patient.lastName?.trim()) missingFields.push('Patient last name')
  if (!patient.dateOfBirth) missingFields.push('Patient date of birth')

  // Subscriber: if not patient, require subscriber details + relationship
  if (!policy.subscriberIsPatient) {
    if (!policy.subscriberFirstName?.trim()) missingFields.push('Subscriber first name')
    if (!policy.subscriberLastName?.trim()) missingFields.push('Subscriber last name')
    if (!policy.subscriberDob) missingFields.push('Subscriber date of birth')
    if (!policy.relationshipToPatient?.trim()) missingFields.push('Relationship to patient')
  }

  // BCBS: require alpha prefix (derive if possible)
  if (isBcbsPayer(policy.payerNameRaw)) {
    const derived = deriveBcbsAlphaPrefix(policy.memberId || '')
    if (!policy.bcbsAlphaPrefix?.trim() && !derived) {
      missingFields.push('BCBS alpha prefix (could not derive from Member ID)')
    }
  }

  // Warnings (non-blocking): address recommended for verification
  if (!patient.postalCode?.trim()) warnings.push('Patient ZIP')
  else if (!ZIP_REGEX.test(patient.postalCode.trim())) {
    warnings.push('Patient ZIP should be 5-digit or ZIP+4')
  }
  if (!patient.addressLine1?.trim()) warnings.push('Address line 1')
  if (!patient.city?.trim()) warnings.push('City')
  if (!patient.state?.trim()) warnings.push('State')

  const status: InsuranceCompletenessStatus =
    missingFields.length === 0 ? 'ready' : 'missing_info'

  return { status, missingFields, warnings }
}

/** Mask member ID for display (show last 4 only). */
export function maskMemberId(memberId: string | null | undefined): string {
  if (!memberId || memberId.length === 0) return '—'
  if (memberId.length <= 4) return '****'
  return `****${memberId.slice(-4)}`
}
