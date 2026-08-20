import type { StediEligibilityRequest, StediEligibilityResponse } from './types'

const MOCK_CONTROL = 'mock-stedi-271'

export function buildMockStediEligibilityResponse(
  request?: Partial<StediEligibilityRequest>
): StediEligibilityResponse {
  return {
    controlNumber: MOCK_CONTROL,
    tradingPartnerServiceId: request?.tradingPartnerServiceId || '87726',
    payer: {
      name: 'Mock Health Plan',
      entityName: 'Mock Health Plan',
      payorIdentification: request?.tradingPartnerServiceId || '87726',
    },
    subscriber: {
      firstName: request?.subscriber?.firstName || 'Jane',
      lastName: request?.subscriber?.lastName || 'Doe',
      memberId: request?.subscriber?.memberId || 'MOCK123456',
      groupNumber: request?.subscriber?.groupNumber || 'GRP001',
    },
    planInformation: {
      groupNumber: request?.subscriber?.groupNumber || 'GRP001',
      groupDescription: 'Mock Employer Group',
    },
    planDateInformation: {
      planBegin: '20240101',
      eligibilityBegin: '20240101',
    },
    planStatus: [
      {
        statusCode: '1',
        status: 'Active Coverage',
        planDetails: 'PPO Gold',
        serviceTypeCodes: ['30'],
      },
    ],
    benefitsInformation: [
      {
        code: '1',
        name: 'Active Coverage',
        insuranceType: 'Preferred Provider Organization (PPO)',
        insuranceTypeCode: '12',
        planCoverage: 'PPO Gold',
        serviceTypeCodes: ['30'],
        inPlanNetworkIndicator: 'Yes',
        inPlanNetworkIndicatorCode: 'Y',
      },
      {
        code: 'B',
        name: 'Co-Payment',
        benefitAmount: '40.00',
        serviceTypeCodes: ['98'],
        serviceTypes: ['Professional (Physician) Visit - Office'],
        inPlanNetworkIndicator: 'Yes',
        inPlanNetworkIndicatorCode: 'Y',
      },
      {
        code: 'C',
        name: 'Deductible',
        benefitAmount: '500.00',
        coverageLevelCode: 'IND',
        timeQualifierCode: 'Calendar Year',
        serviceTypeCodes: ['30'],
        inPlanNetworkIndicator: 'Yes',
        inPlanNetworkIndicatorCode: 'Y',
      },
      {
        code: 'C',
        name: 'Deductible',
        benefitAmount: '250.00',
        coverageLevelCode: 'IND',
        quantityQualifier: 'Remaining',
        serviceTypeCodes: ['30'],
        inPlanNetworkIndicator: 'Yes',
        inPlanNetworkIndicatorCode: 'Y',
      },
      {
        code: 'A',
        name: 'Co-Insurance',
        benefitPercent: '0.20',
        serviceTypeCodes: ['30'],
        inPlanNetworkIndicator: 'Yes',
        inPlanNetworkIndicatorCode: 'Y',
      },
      {
        code: 'G',
        name: 'Out of Pocket (Stop Loss)',
        benefitAmount: '3000.00',
        coverageLevelCode: 'IND',
        timeQualifierCode: 'Calendar Year',
        serviceTypeCodes: ['30'],
        inPlanNetworkIndicator: 'Yes',
        inPlanNetworkIndicatorCode: 'Y',
      },
      {
        code: 'G',
        name: 'Out of Pocket (Stop Loss)',
        benefitAmount: '2100.00',
        coverageLevelCode: 'IND',
        quantityQualifier: 'Remaining',
        serviceTypeCodes: ['30'],
        inPlanNetworkIndicator: 'Yes',
        inPlanNetworkIndicatorCode: 'Y',
      },
    ],
    errors: [],
  }
}

export async function handleMockStediRequest<T>(params: {
  method: 'GET' | 'POST'
  path: string
  query?: Record<string, string | undefined>
  jsonBody?: unknown
}): Promise<T> {
  const { method, path, query, jsonBody } = params

  if (method === 'POST' && path.includes('/eligibility/v3')) {
    return buildMockStediEligibilityResponse(jsonBody as Partial<StediEligibilityRequest>) as T
  }

  if (method === 'GET' && path.includes('/payers/search')) {
    const q = (query?.query || '').toLowerCase()
    const payers = [
      {
        payer: {
          stediId: 'QDTRP',
          displayName: 'Blue Cross Blue Shield of Texas',
          primaryPayerId: 'G84980',
          aliases: ['84980', 'TXBCBS'],
          names: ['Blue Cross Blue Shield of Texas'],
          transactionSupport: { eligibilityCheck: 'SUPPORTED' },
        },
      },
      {
        payer: {
          stediId: 'AETNA',
          displayName: 'Aetna',
          primaryPayerId: '60054',
          aliases: ['AETNA'],
          names: ['Aetna'],
          transactionSupport: { eligibilityCheck: 'SUPPORTED' },
        },
      },
      {
        payer: {
          stediId: 'UHC',
          displayName: 'UnitedHealthcare',
          primaryPayerId: '87726',
          aliases: ['UHC'],
          names: ['UnitedHealthcare'],
          transactionSupport: { eligibilityCheck: 'SUPPORTED' },
        },
      },
    ].filter((item) => {
      if (!q) return true
      const hay = [
        item.payer.displayName,
        item.payer.primaryPayerId,
        item.payer.stediId,
        ...(item.payer.aliases || []),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
    return { items: payers } as T
  }

  return {} as T
}
