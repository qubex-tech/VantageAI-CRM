import { describe, expect, it } from 'vitest'
import { mapToStediEligibilityRequest } from '../map-request'
import { parseStediEligibilityResponse } from '../parse-response'
import { formatEligibilityNoteContent } from '@/lib/availity/parse-response'
import { buildMockStediEligibilityResponse } from '../mock-client'
import { searchStediPayers } from '../payer-search'
import { resolvePayerIdFromName } from '@/lib/eligibility/clearinghouse/match-payer-from-name'
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

describe('searchStediPayers + name resolve', () => {
  const mockConfig = {
    practiceId: 'p1',
    apiKey: 'mock',
    environment: 'test' as const,
    apiBaseUrl: 'https://healthcare.us.stedi.com/2024-04-01',
    useMockResponses: true,
    isActive: true,
  }

  it('resolves an eCW payer name through Stedi payer search', async () => {
    const match = await resolvePayerIdFromName({
      payerName: 'AETNA',
      searchPayers: (query) => searchStediPayers(mockConfig, query),
    })
    expect(match.status).toBe('matched')
    if (match.status === 'matched') expect(match.payerId).toBe('60054')
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
    expect(summary.rheum?.verifiedBy).toBe('Eligibility check')
    expect(summary.coverageDetail?.planType).toBe('PPO')
    expect(summary.coverageDetail?.inn?.deductible?.total).toBe('$500.00')
    expect(summary.coverageDetail?.inn?.deductible?.remaining).toBe('$250.00')
    expect(summary.coverageDetail?.inn?.oop?.total).toBe('$3000.00')
    expect(summary.coverageDetail?.copays?.length).toBeGreaterThan(0)
  })

  it('formats the full 271 snapshot including remaining amounts and correspondence', () => {
    const summary = parseStediEligibilityResponse({
      controlNumber: '872057204',
      tradingPartnerServiceId: '60054',
      payer: { name: 'AETNA INC', payorIdentification: '953402799' },
      subscriber: {
        firstName: 'JANE',
        lastName: 'DOE',
        memberId: 'AETNA12345',
        dateOfBirth: '20040404',
        gender: 'F',
        groupNumber: '111222333444555',
        planNumber: '1122334',
        address: { address1: '101 MAIN ST', city: 'TRENTON', state: 'NJ', postalCode: '08601' },
      },
      planInformation: {
        planNumber: '1122334',
        groupNumber: '111222333444555',
        groupDescription: 'New Jersey Plan',
      },
      planDateInformation: { service: '20240917', planBegin: '20240401' },
      planStatus: [
        { status: 'Active Coverage', statusCode: '1', planDetails: 'Gold Plan', serviceTypeCodes: ['30'] },
        {
          status: 'Active Coverage',
          statusCode: '1',
          serviceTypeCodes: ['1', '33', '47', '48', '50', '86', '98', 'UC', 'MH', 'AL'],
        },
      ],
      benefitsInformation: [
        {
          code: 'W',
          name: 'Other Source of Data',
          inPlanNetworkIndicatorCode: 'W',
          benefitsRelatedEntity: {
            entityName: 'Aetna',
            address: { address1: '202 Main St', city: 'El Paso', state: 'TX', postalCode: '79998' },
          },
        },
        {
          code: '1',
          name: 'Active Coverage',
          serviceTypeCodes: ['30'],
          coverageLevel: 'Employee Only',
          insuranceType: 'Preferred Provider Organization (PPO)',
          planCoverage: 'Gold Plan',
          inPlanNetworkIndicatorCode: 'W',
        },
        {
          code: 'C',
          name: 'Deductible',
          benefitAmount: '500',
          timeQualifier: 'Contract',
          timeQualifierCode: '25',
          coverageLevel: 'Individual',
          serviceTypeCodes: ['30'],
          inPlanNetworkIndicatorCode: 'Y',
        },
        {
          code: 'C',
          name: 'Deductible',
          benefitAmount: '500',
          timeQualifier: 'Remaining',
          timeQualifierCode: '29',
          coverageLevel: 'Individual',
          serviceTypeCodes: ['30'],
          inPlanNetworkIndicatorCode: 'Y',
        },
        {
          code: 'G',
          name: 'Out of Pocket (Stop Loss)',
          benefitAmount: '7000',
          timeQualifier: 'Remaining',
          timeQualifierCode: '29',
          coverageLevel: 'Individual',
          serviceTypeCodes: ['30'],
          inPlanNetworkIndicatorCode: 'Y',
        },
        {
          code: 'C',
          name: 'Deductible',
          benefitAmount: '1000',
          timeQualifier: 'Contract',
          timeQualifierCode: '25',
          coverageLevel: 'Individual',
          serviceTypeCodes: ['30'],
          inPlanNetworkIndicatorCode: 'N',
        },
        {
          code: 'B',
          name: 'Co-Payment',
          benefitAmount: '30',
          serviceTypeCodes: ['98', 'MH', 'UC'],
          inPlanNetworkIndicatorCode: 'Y',
          additionalInformation: [
            { description: 'Office Visits' },
            { description: 'Walk in Clinic' },
            { description: 'Mental Health (outpatient)' },
          ],
        },
        {
          code: 'B',
          name: 'Co-Payment',
          benefitAmount: '25',
          serviceTypeCodes: ['33'],
          inPlanNetworkIndicatorCode: 'Y',
          additionalInformation: [{ description: 'Chiropractic' }],
        },
        {
          code: 'A',
          name: 'Co-Insurance',
          benefitPercent: '0',
          serviceTypeCodes: ['98'],
          inPlanNetworkIndicatorCode: 'Y',
          additionalInformation: [{ description: 'Office Visits' }],
        },
        {
          code: 'A',
          name: 'Co-Insurance',
          benefitPercent: '0.5',
          serviceTypeCodes: ['98'],
          inPlanNetworkIndicatorCode: 'N',
          additionalInformation: [{ description: 'Office Visits' }],
        },
      ],
    })

    const detail = summary.coverageDetail
    expect(detail?.payerName).toBe('Aetna Inc')
    expect(detail?.payerId).toBe('953402799')
    expect(detail?.planName).toBe('Gold Plan')
    expect(detail?.planDescription).toBe('New Jersey Plan')
    expect(detail?.planNumber).toBe('1122334')
    expect(detail?.groupNumber).toBe('111222333444555')
    expect(detail?.coverageLevel).toBe('Employee Only')
    expect(detail?.serviceDate).toBe('2024-09-17')
    expect(detail?.coverageStartDate).toBe('2024-04-01')
    expect(detail?.inn?.deductible).toEqual({ total: '$500', remaining: '$500' })
    expect(detail?.oon?.deductible?.total).toBe('$1000')
    expect(detail?.inn?.officeCopay).toBe('$30')
    expect(detail?.inn?.officeCoinsurance).toBe('0%')
    expect(detail?.oon?.officeCoinsurance).toBe('50%')
    expect(detail?.copays?.some((row) => row.amount === '$25' && row.services.includes('Chiropractic'))).toBe(true)
    expect(detail?.subscriber?.firstName).toBe('Jane')
    expect(detail?.subscriber?.gender).toBe('Female')
    expect(detail?.subscriber?.address).toContain('Trenton')
    expect(detail?.payerCorrespondence?.address).toContain('El Paso')
    expect(detail?.referenceNumber).toBe('872057204')
    expect(JSON.stringify(detail)).not.toMatch(/stedi/i)
    expect(summary.rheum?.verifiedBy).toBe('Eligibility check')
    const note = formatEligibilityNoteContent({ summary, sourceLabel: null })
    expect(note).toContain('Eligibility / Billing Note\n')
    expect(note).toContain('Gold Plan')
    expect(note).toContain('Walk in Clinic')
    expect(note).toContain('Financials')
    expect(note).not.toMatch(/stedi/i)
  })

  it('treats timeQualifier Remaining as remaining deductible', () => {
    const response = buildMockStediEligibilityResponse()
    response.benefitsInformation = [
      {
        code: 'C',
        name: 'Deductible',
        benefitAmount: '500',
        timeQualifier: 'Remaining',
        timeQualifierCode: '29',
        serviceTypeCodes: ['30'],
        inPlanNetworkIndicatorCode: 'Y',
      },
    ]
    const summary = parseStediEligibilityResponse(response)
    expect(summary.rheum?.deductible?.remaining).toBe('$500')
    expect(summary.coverageDetail?.inn?.deductible?.remaining).toBe('$500')
  })
})
