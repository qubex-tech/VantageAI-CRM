/**
 * Deterministic readiness for insurance verification (no clearinghouse calls).
 */
const ZIP_REGEX = /^\d{5}(-\d{4})?$/

function isBcbsPayer(payerName: string): boolean {
  const n = (payerName ?? '').toUpperCase()
  return n.includes('BCBS') || n.includes('BLUE CROSS')
}

function deriveBcbsAlphaPrefix(memberId: string): string | null {
  if (!memberId || memberId.length < 3) return null
  const prefix = memberId.substring(0, 3)
  if (/^[A-Za-z]+$/.test(prefix)) return prefix
  return null
}

function getPatientNameParts(patient: {
  firstName?: string | null
  lastName?: string | null
  name?: string | null
}): { firstName: string; lastName: string } | null {
  const first = patient.firstName?.trim()
  const last = patient.lastName?.trim()
  const full = patient.name?.trim()
  let fromName: { first: string; last: string } | null = null
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean)
    if (parts.length >= 1) {
      fromName =
        parts.length === 1
          ? { first: parts[0], last: parts[0] }
          : { first: parts[0], last: parts.slice(1).join(' ') }
    }
  }
  const firstName = first || fromName?.first || ''
  const lastName = last || fromName?.last || ''
  if (!firstName && !lastName) return null
  return { firstName: firstName || lastName, lastName: lastName || firstName }
}

export type ReadinessStatus = 'READY' | 'NEEDS_INFO'

export interface MissingField {
  field: string
  reason: string
}

export interface ReadinessResult {
  status: ReadinessStatus
  missing_fields: MissingField[]
  warnings: { field: string; reason: string }[]
}

export function computeReadiness(
  policy: {
    payerNameRaw: string
    insurerPhoneRaw?: string | null
    memberId: string
    subscriberIsPatient: boolean
    subscriberFirstName?: string | null
    subscriberLastName?: string | null
    subscriberDob?: Date | string | null
    relationshipToPatient?: string | null
    bcbsAlphaPrefix?: string | null
  },
  patient: {
    firstName?: string | null
    lastName?: string | null
    name?: string | null
    dateOfBirth?: Date | string | null
    addressLine1?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
  }
): ReadinessResult {
  const missing_fields: MissingField[] = []
  const warnings: { field: string; reason: string }[] = []

  if (!policy.payerNameRaw?.trim()) {
    missing_fields.push({ field: 'payer_name_raw', reason: 'Required for verification' })
  }
  if (!policy.memberId?.trim()) {
    missing_fields.push({ field: 'member_id', reason: 'Required for verification' })
  }
  if (!policy.insurerPhoneRaw?.trim()) {
    warnings.push({ field: 'insurance.insurer_phone', reason: 'Required before starting outbound insurer call' })
  }

  const nameParts = getPatientNameParts(patient)
  if (!nameParts?.firstName?.trim()) {
    missing_fields.push({ field: 'patient.first_name', reason: 'Required for verification' })
  }
  if (!nameParts?.lastName?.trim()) {
    missing_fields.push({ field: 'patient.last_name', reason: 'Required for verification' })
  }
  if (!patient.dateOfBirth) {
    missing_fields.push({ field: 'patient.date_of_birth', reason: 'Required for verification' })
  }

  if (!policy.subscriberIsPatient) {
    if (!policy.subscriberFirstName?.trim()) {
      missing_fields.push({ field: 'subscriber.first_name', reason: 'Required when subscriber is not patient' })
    }
    if (!policy.subscriberLastName?.trim()) {
      missing_fields.push({ field: 'subscriber.last_name', reason: 'Required when subscriber is not patient' })
    }
    if (!policy.subscriberDob) {
      missing_fields.push({ field: 'subscriber.dob', reason: 'Required when subscriber is not patient' })
    }
    if (!policy.relationshipToPatient?.trim()) {
      missing_fields.push({ field: 'relationship_to_patient', reason: 'Required when subscriber is not patient' })
    }
  }

  if (isBcbsPayer(policy.payerNameRaw)) {
    const derived = deriveBcbsAlphaPrefix(policy.memberId ?? '')
    if (!policy.bcbsAlphaPrefix?.trim() && !derived) {
      missing_fields.push({
        field: 'bcbs_alpha_prefix',
        reason: 'Could not derive from Member ID; required for BCBS',
      })
    }
  }

  if (!patient.postalCode?.trim()) {
    warnings.push({ field: 'patient.postal_code', reason: 'Recommended for verification' })
  } else if (!ZIP_REGEX.test(patient.postalCode.trim())) {
    warnings.push({ field: 'patient.postal_code', reason: 'Should be 5-digit or ZIP+4' })
  }
  if (!patient.addressLine1?.trim()) {
    warnings.push({ field: 'patient.address_line1', reason: 'Recommended for verification' })
  }
  if (!patient.city?.trim()) {
    warnings.push({ field: 'patient.city', reason: 'Recommended for verification' })
  }
  if (!patient.state?.trim()) {
    warnings.push({ field: 'patient.state', reason: 'Recommended for verification' })
  }

  const status: ReadinessStatus = missing_fields.length === 0 ? 'READY' : 'NEEDS_INFO'
  return { status, missing_fields, warnings }
}
