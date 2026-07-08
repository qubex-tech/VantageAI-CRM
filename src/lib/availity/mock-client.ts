import type { AvailityCoverageRecord, CoverageInquiryRequest } from './types'

const MOCK_COVERAGE_ID = 'mock-coverage-1234567890'

function buildCompleteCoverage(request?: Partial<CoverageInquiryRequest>): AvailityCoverageRecord {
  return {
    id: MOCK_COVERAGE_ID,
    status: 'Complete',
    statusCode: '4',
    asOfDate: new Date().toISOString(),
    payer: {
      payerId: request?.payerId || 'MOCKPAYER',
      name: 'Mock Health Plan',
    },
    patient: {
      firstName: request?.patientFirstName || 'Jane',
      lastName: request?.patientLastName || 'Doe',
      birthDate: request?.patientBirthDate || '1990-01-01',
    },
    subscriber: {
      memberId: request?.memberId || 'MOCK123456',
    },
    plans: [
      {
        status: 'Active Coverage',
        statusCode: '1',
        groupNumber: request?.groupNumber || 'GRP001',
        groupName: 'Mock Employer Group',
        description: 'PPO Gold',
        insuranceType: 'Preferred Provider Organization (PPO)',
        eligibilityStartDate: '2024-01-01T00:00:00.000+0000',
        coverageStartDate: '2024-01-01T00:00:00.000+0000',
        benefits: [
          {
            name: 'Health Benefit Plan Coverage',
            type: '30',
            status: 'Active Coverage',
            statusCode: '1',
            amounts: {
              coPayment: { amount: '25.00', currency: 'USD' },
              deductible: { amount: '500.00', currency: 'USD', remaining: '250.00' },
            },
          },
        ],
      },
    ],
    validationMessages: [],
  }
}

export async function handleMockAvailityRequest<T>(params: {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  query?: Record<string, string | string[] | undefined>
  formBody?: Record<string, string | string[] | undefined>
  mockScenarioId?: string
}): Promise<T> {
  const { method, path, formBody, mockScenarioId } = params
  const scenario = mockScenarioId || 'Coverages-Complete-i'

  if (method === 'POST' && path.includes('/coverages')) {
    if (scenario === 'Coverages-RequestError1-i') {
      throw Object.assign(new Error('Mock validation error'), {
        name: 'AvailityApiError',
        statusCode: 400,
        userMessage: 'Mock request validation failed',
        errors: [{ field: 'providerNpi', errorMessage: 'Enter a valid NPI' }],
      })
    }

    const request = formBody as Partial<CoverageInquiryRequest> | undefined
    if (scenario === 'Coverages-InProgress-i') {
      return {
        id: MOCK_COVERAGE_ID,
        status: 'In Progress',
        statusCode: '0',
        etaDate: new Date(Date.now() + 3000).toISOString(),
        payer: { payerId: request?.payerId, name: 'Mock Health Plan' },
      } as T
    }

    return buildCompleteCoverage(request) as T
  }

  if (method === 'GET' && path.includes('/coverages/')) {
    const id = path.split('/coverages/')[1]?.split('?')[0]
    if (scenario === 'Coverages-InProgress-i' && id === MOCK_COVERAGE_ID) {
      return buildCompleteCoverage() as T
    }
    return buildCompleteCoverage() as T
  }

  if (method === 'GET' && path.includes('/availity-payer-list')) {
    return {
      totalCount: 2,
      count: 2,
      offset: 0,
      limit: 50,
      payers: [
        { payerId: 'BCBSF', name: 'BCBSF', displayName: 'Florida Blue' },
        { payerId: 'AETNA', name: 'AETNA', displayName: 'Aetna' },
      ],
    } as T
  }

  if (method === 'GET' && path.includes('/configurations')) {
    return {
      configurations: [
        {
          type: '270',
          payerId: formBody?.payerId || 'MOCKPAYER',
          elements: {
            providerNpi: { required: true },
            memberId: { required: true },
            patientBirthDate: { required: true },
            serviceType: { required: true },
          },
        },
      ],
    } as T
  }

  return {} as T
}
