import { orderServiceTypeCodesForRequest } from '@/lib/eligibility/service-types'
import type { CanonicalEligibilityRequest } from '@/lib/eligibility/clearinghouse/types'
import type { StediEligibilityRequest } from './types'

const RELATIONSHIP_TO_STEDI: Record<string, string> = {
  spouse: '01',
  child: '19',
  other: '34',
}

function toStediDate(isoDate: string | null | undefined): string | undefined {
  if (!isoDate) return undefined
  const compact = isoDate.replace(/-/g, '')
  return /^\d{8}$/.test(compact) ? compact : undefined
}

function mapGender(gender?: string | null): string | undefined {
  const normalized = String(gender || '').trim().toLowerCase()
  if (['male', 'm'].includes(normalized)) return 'M'
  if (['female', 'f'].includes(normalized)) return 'F'
  return undefined
}

function mapRelationship(relationship?: string | null): string {
  const rel = String(relationship || '').trim().toLowerCase()
  if (rel.includes('spouse')) return RELATIONSHIP_TO_STEDI.spouse
  if (rel.includes('child')) return RELATIONSHIP_TO_STEDI.child
  return RELATIONSHIP_TO_STEDI.other
}

export function mapToStediEligibilityRequest(
  input: CanonicalEligibilityRequest
): StediEligibilityRequest {
  const organizationName = input.providerOrganizationName?.trim()
  if (!organizationName) {
    throw new Error(
      'Provider organization name is required for eligibility checks. Set it in eligibility settings.'
    )
  }

  const request: StediEligibilityRequest = {
    tradingPartnerServiceId: input.payerId,
    encounter: {
      serviceTypeCodes: orderServiceTypeCodesForRequest(
        input.serviceTypeCodes?.length ? input.serviceTypeCodes : [input.serviceType || '30']
      ),
    },
    provider: {
      organizationName,
      npi: input.providerNpi,
      ...(input.providerTaxId ? { taxId: input.providerTaxId } : {}),
    },
    subscriber: {},
  }

  if (input.subscriberIsPatient) {
    request.subscriber = {
      firstName: input.patientFirstName,
      lastName: input.patientLastName,
      memberId: input.memberId,
      dateOfBirth: toStediDate(input.patientBirthDate),
      gender: mapGender(input.patientGender),
      groupNumber: input.groupNumber || undefined,
    }
    return request
  }

  request.subscriber = {
    firstName: input.subscriberFirstName || undefined,
    lastName: input.subscriberLastName || undefined,
    memberId: input.memberId,
    dateOfBirth: toStediDate(input.subscriberDob),
    groupNumber: input.groupNumber || undefined,
  }
  request.dependents = [
    {
      firstName: input.patientFirstName,
      lastName: input.patientLastName,
      dateOfBirth: toStediDate(input.patientBirthDate),
      gender: mapGender(input.patientGender),
      individualRelationshipCode: mapRelationship(input.relationshipToPatient),
    },
  ]
  return request
}

export function redactStediRequest(
  request: StediEligibilityRequest
): Record<string, unknown> {
  return {
    tradingPartnerServiceId: request.tradingPartnerServiceId,
    memberId: request.subscriber.memberId
      ? `***${request.subscriber.memberId.slice(-4)}`
      : null,
    subscriberFirstName: request.subscriber.firstName
      ? `${request.subscriber.firstName.slice(0, 1)}***`
      : null,
    hasDependents: Boolean(request.dependents?.length),
    npi: request.provider.npi,
    serviceTypeCodes: request.encounter?.serviceTypeCodes,
  }
}
