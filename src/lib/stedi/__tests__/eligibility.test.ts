import { describe, expect, it } from 'vitest'
import { mapToStediEligibilityRequest } from '../map-request'
import { parseStediEligibilityResponse } from '../parse-response'
import { buildMockStediEligibilityResponse } from '../mock-client'
import type { CanonicalEligibilityRequest } from '@/lib/eligibility/clearinghouse/types'

function baseInput(overrides?: Partial<CanonicalEligibilityRequest>): CanonicalEligibilityRequest {
  return {
    practiceId: 'p1',
    payerId: '87726',
    memberId: 'UHC202649',
    patientFirstName: 'Jane',
    patientLastName: 'Doe',
    patientBirthDate: '1952-11-21',
    providerNpi: '1999999984',
    providerOrganizationName: 'Lonestar Rheumatology',
    serviceType: '30',
    subscriberIsPatient: true,
    ...overrides,
  }
}

describe('mapToStediEligibilityRequest', () => {
  it('puts the patient in subscriber when they are the subscriber', () => {
    const request = mapToStediEligibilityRequest(baseInput())
    expect(request.tradingPartnerServiceId).toBe('87726')
    expect(request.subscriber.memberId).toBe('UHC202649')
    expect(request.subscriber.dateOfBirth).toBe('19521121')
    expect(request.dependents).toBeUndefined()
    expect(request.provider.organizationName).toBe('Lonestar Rheumatology')
    expect(request.encounter?.serviceTypeCodes).toEqual(['30'])
  })

  it('puts the patient in dependents when they are not the subscriber', () => {
    const request = mapToStediEligibilityRequest(
      baseInput({
        subscriberIsPatient: false,
        subscriberFirstName: 'John',
        subscriberLastName: 'Doe',
        subscriberDob: '1950-01-01',
        relationshipToPatient: 'Spouse',
      })
    )
    expect(request.subscriber.firstName).toBe('John')
    expect(request.dependents?.[0]?.firstName).toBe('Jane')
    expect(request.dependents?.[0]?.relationshipToSubscriberCode).toBe('01')
  })

  it('requires organization name', () => {
    expect(() =>
      mapToStediEligibilityRequest(baseInput({ providerOrganizationName: null }))
    ).toThrow(/organization name/i)
  })
})

describe('parseStediEligibilityResponse', () => {
  it('extracts active coverage, copay, deductible, coinsurance, and OOP', () => {
    const summary = parseStediEligibilityResponse(buildMockStediEligibilityResponse())
    expect(summary.eligibilityStatus).toBe('active')
    expect(summary.planType).toBe('PPO')
    expect(summary.rheum?.source).toBe('stedi_api')
    expect(summary.rheum?.specialistCopay).toBe('$40.00')
    expect(summary.rheum?.deductible?.total).toBe('$500.00')
    expect(summary.rheum?.deductible?.remaining).toBe('$250.00')
    expect(summary.rheum?.coinsurance).toBe('20%')
    expect(summary.rheum?.oop?.max).toBe('$3000.00')
    expect(summary.rheum?.oop?.remaining).toBe('$2100.00')
    expect(summary.rheum?.networkStatus).toBe('inn')
    expect(summary.rheum?.verifiedBy).toBe('Stedi')
  })
})
