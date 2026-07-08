import { formatPatientDob } from '@/lib/mcp/verification-fields'
import type { CoverageInquiryRequest } from './types'

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
  availityPayerId?: string | null
  subscriberIsPatient: boolean
  relationshipToPatient?: string | null
}

const RELATIONSHIP_TO_AVAILITY: Record<string, string> = {
  self: '18',
  spouse: '01',
  child: '19',
  other: 'G8',
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

function mapGender(gender?: string | null): string | undefined {
  const normalized = String(gender || '').trim().toLowerCase()
  if (!normalized) return undefined
  if (['male', 'm'].includes(normalized)) return 'M'
  if (['female', 'f'].includes(normalized)) return 'F'
  return 'U'
}

function mapSubscriberRelationship(policy: PolicyRecord): string {
  if (policy.subscriberIsPatient) return '18'
  const rel = String(policy.relationshipToPatient || '').trim().toLowerCase()
  if (rel.includes('spouse')) return RELATIONSHIP_TO_AVAILITY.spouse
  if (rel.includes('child')) return RELATIONSHIP_TO_AVAILITY.child
  return RELATIONSHIP_TO_AVAILITY.other
}

export function mapToCoverageInquiryRequest(params: {
  patient: PatientRecord
  policy: PolicyRecord
  payerId: string
  providerNpi: string
  serviceType: string
  providerTaxId?: string | null
  submitterId?: string | null
  asOfDate?: string
}): CoverageInquiryRequest {
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
    throw new Error('Availity payer ID is required. Map the payer in insurance settings.')
  }
  if (!params.providerNpi?.trim()) {
    throw new Error('Provider NPI is required. Configure it in Availity settings.')
  }

  return {
    payerId: params.payerId.trim(),
    memberId: params.policy.memberId.trim(),
    patientFirstName: nameParts.firstName,
    patientLastName: nameParts.lastName,
    patientBirthDate: dob,
    providerNpi: params.providerNpi.trim(),
    serviceType: params.serviceType || '30',
    groupNumber: params.policy.groupNumber?.trim() || undefined,
    patientState: params.patient.state?.trim() || undefined,
    patientGender: mapGender(params.patient.gender),
    subscriberRelationship: mapSubscriberRelationship(params.policy),
    providerTaxId: params.providerTaxId?.trim() || undefined,
    submitterId: params.submitterId?.trim() || undefined,
    asOfDate: params.asOfDate || new Date().toISOString().slice(0, 10),
  }
}

export function coverageRequestToFormBody(request: CoverageInquiryRequest): Record<string, string | string[]> {
  const body: Record<string, string | string[]> = {
    payerId: request.payerId,
    memberId: request.memberId,
    patientFirstName: request.patientFirstName,
    patientLastName: request.patientLastName,
    patientBirthDate: request.patientBirthDate,
    providerNpi: request.providerNpi,
    'serviceType[]': request.serviceType,
    subscriberRelationship: request.subscriberRelationship || '18',
  }

  if (request.groupNumber) body.groupNumber = request.groupNumber
  if (request.patientState) body.patientState = request.patientState
  if (request.patientGender) body.patientGender = request.patientGender
  if (request.providerTaxId) body.providerTaxId = request.providerTaxId
  if (request.submitterId) body.submitterId = request.submitterId
  if (request.asOfDate) body.asOfDate = request.asOfDate

  return body
}

/** Redact PHI for audit storage */
export function redactCoverageRequest(request: CoverageInquiryRequest): Record<string, string> {
  return {
    payerId: request.payerId,
    memberId: `***${request.memberId.slice(-4)}`,
    patientFirstName: request.patientFirstName.slice(0, 1) + '***',
    patientLastName: request.patientLastName.slice(0, 1) + '***',
    patientBirthDate: request.patientBirthDate,
    providerNpi: request.providerNpi,
    serviceType: request.serviceType,
  }
}
