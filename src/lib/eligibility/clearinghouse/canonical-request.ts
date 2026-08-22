import { formatPatientDob } from '@/lib/mcp/verification-fields'
import { normalizeServiceTypeCodes, primaryServiceTypeCode } from '@/lib/eligibility/service-types'
import type { CanonicalEligibilityRequest } from './types'

type PatientRecord = {
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  dateOfBirth?: Date | string | null
  state?: string | null
  gender?: string | null
}

type PolicyRecord = {
  memberId: string
  groupNumber?: string | null
  subscriberIsPatient: boolean
  subscriberFirstName?: string | null
  subscriberLastName?: string | null
  subscriberDob?: Date | string | null
  relationshipToPatient?: string | null
}

function getPatientNameParts(patient: PatientRecord): { firstName: string; lastName: string } {
  const first = patient.firstName?.trim()
  const last = patient.lastName?.trim()
  const full = patient.name?.trim()
  if (first || last) {
    return { firstName: first || '', lastName: last || '' }
  }
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] }
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
  }
  return { firstName: '', lastName: '' }
}

export function mapToCanonicalEligibilityRequest(params: {
  practiceId: string
  patient: PatientRecord
  policy: PolicyRecord
  payerId: string
  providerNpi: string
  serviceType: string
  serviceTypeCodes?: string[]
  providerOrganizationName?: string | null
  providerTaxId?: string | null
  asOfDate?: string
}): CanonicalEligibilityRequest {
  const nameParts = getPatientNameParts(params.patient)
  const dob = formatPatientDob(params.patient.dateOfBirth)
  if (!nameParts.firstName || !nameParts.lastName) {
    throw new Error('Patient first and last name are required for eligibility check')
  }
  if (!dob) {
    throw new Error('Patient date of birth is required for eligibility check')
  }
  if (!params.policy.memberId?.trim()) {
    throw new Error('Member ID is required for eligibility check')
  }
  if (!params.payerId?.trim()) {
    throw new Error('Clearinghouse payer ID is required. Map the payer on the insurance policy.')
  }
  if (!params.providerNpi?.trim()) {
    throw new Error('Provider NPI is required. Configure it in eligibility settings.')
  }

  return {
    practiceId: params.practiceId,
    payerId: params.payerId.trim(),
    memberId: params.policy.memberId.trim(),
    patientFirstName: nameParts.firstName,
    patientLastName: nameParts.lastName,
    patientBirthDate: dob,
    providerNpi: params.providerNpi.trim(),
    providerOrganizationName: params.providerOrganizationName?.trim() || null,
    providerTaxId: params.providerTaxId?.trim() || null,
    serviceType: primaryServiceTypeCode(
      normalizeServiceTypeCodes(params.serviceTypeCodes ?? params.serviceType)
    ),
    serviceTypeCodes: normalizeServiceTypeCodes(params.serviceTypeCodes ?? params.serviceType),
    groupNumber: params.policy.groupNumber?.trim() || undefined,
    subscriberIsPatient: params.policy.subscriberIsPatient,
    subscriberFirstName: params.policy.subscriberFirstName?.trim() || null,
    subscriberLastName: params.policy.subscriberLastName?.trim() || null,
    subscriberDob: formatPatientDob(params.policy.subscriberDob) || null,
    relationshipToPatient: params.policy.relationshipToPatient?.trim() || null,
    patientGender: params.patient.gender?.trim() || null,
    patientState: params.patient.state?.trim() || null,
    asOfDate: params.asOfDate || new Date().toISOString().slice(0, 10),
  }
}

export function redactCanonicalRequest(
  request: CanonicalEligibilityRequest
): Record<string, string | boolean | null> {
  return {
    payerId: request.payerId,
    memberId: `***${request.memberId.slice(-4)}`,
    patientFirstName: `${request.patientFirstName.slice(0, 1)}***`,
    patientLastName: `${request.patientLastName.slice(0, 1)}***`,
    patientBirthDate: request.patientBirthDate,
    providerNpi: request.providerNpi,
    serviceType: request.serviceType,
    serviceTypeCodes: (request.serviceTypeCodes || []).join(','),
    subscriberIsPatient: request.subscriberIsPatient,
    providerOrganizationName: request.providerOrganizationName || null,
  }
}
