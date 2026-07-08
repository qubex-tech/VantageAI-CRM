import { availityRequest } from './client'
import { coverageRequestToFormBody } from './map-request'
import type { AvailityCoverageRecord, AvailityIntegrationConfig, CoverageInquiryRequest } from './types'

export async function submitCoverageInquiry(
  config: AvailityIntegrationConfig,
  request: CoverageInquiryRequest,
  mockScenarioId?: string
): Promise<AvailityCoverageRecord> {
  const formBody = coverageRequestToFormBody(request)
  return availityRequest<AvailityCoverageRecord>({
    config,
    method: 'POST',
    path: '/coverages',
    formBody,
    mockScenarioId,
  })
}

export async function getCoverageById(
  config: AvailityIntegrationConfig,
  coverageId: string,
  mockScenarioId?: string
): Promise<AvailityCoverageRecord> {
  const result = await availityRequest<AvailityCoverageRecord | { coverages?: AvailityCoverageRecord[] }>({
    config,
    method: 'GET',
    path: `/coverages/${encodeURIComponent(coverageId)}`,
    mockScenarioId,
  })

  if (result && typeof result === 'object' && 'coverages' in result && Array.isArray(result.coverages)) {
    return result.coverages[0] || {}
  }

  return result as AvailityCoverageRecord
}
