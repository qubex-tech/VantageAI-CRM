import { describe, expect, it } from 'vitest'
import { handleMockAvailityRequest } from '@/lib/availity/mock-client'
import { isCoverageInProgress } from '@/lib/availity/types'

describe('Availity mock client', () => {
  it('returns complete coverage on POST /coverages', async () => {
    const result = await handleMockAvailityRequest({
      method: 'POST',
      path: '/coverages',
      formBody: {
        payerId: 'BCBSF',
        memberId: 'TEST123',
        patientFirstName: 'Jane',
        patientLastName: 'Doe',
        patientBirthDate: '1990-01-01',
        providerNpi: '1234567890',
      },
    })

    expect(result.status).toBe('Complete')
    expect(result.statusCode).toBe('4')
    expect(isCoverageInProgress(result)).toBe(false)
    expect(Array.isArray(result.plans)).toBe(true)
  })

  it('returns in-progress then complete on GET', async () => {
    const inProgress = await handleMockAvailityRequest({
      method: 'POST',
      path: '/coverages',
      mockScenarioId: 'Coverages-InProgress-i',
    })
    expect(isCoverageInProgress(inProgress)).toBe(true)

    const complete = await handleMockAvailityRequest({
      method: 'GET',
      path: '/coverages/mock-coverage-1234567890',
      mockScenarioId: 'Coverages-InProgress-i',
    })
    expect(complete.status).toBe('Complete')
  })

  it('searches mock payer list', async () => {
    const result = await handleMockAvailityRequest<{
      payers: Array<{ payerId: string }>
    }>({
      method: 'GET',
      path: '/availity-payer-list',
    })
    expect(result.payers?.length).toBeGreaterThan(0)
  })
})
