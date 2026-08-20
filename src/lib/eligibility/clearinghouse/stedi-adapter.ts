import {
  getStediIntegrationConfig,
  isStediConfigured,
  isStediPayerDown,
  mapToStediEligibilityRequest,
  parseStediEligibilityResponse,
  redactStediRequest,
  searchStediPayers,
  StediApiError,
  submitStediEligibilityCheck,
} from '@/lib/stedi'
import type {
  CanonicalEligibilityRequest,
  CanonicalEligibilityResult,
  ClearinghouseAdapter,
  PayerSearchResult,
} from './types'

export const stediAdapter: ClearinghouseAdapter = {
  vendorKey: 'stedi',
  displayName: 'Stedi',
  capabilities: { asyncPoll: false, payerSearch: true },

  async isConfigured(practiceId: string) {
    return isStediConfigured(practiceId)
  },

  async checkEligibility(input: CanonicalEligibilityRequest): Promise<CanonicalEligibilityResult> {
    const config = await getStediIntegrationConfig(input.practiceId)
    if (!config.isActive) {
      throw new Error('Eligibility is not enabled for this practice')
    }

    const request = mapToStediEligibilityRequest(input)
    const redactedRequest = redactStediRequest(request)

    let response
    try {
      response = await submitStediEligibilityCheck(config, request)
    } catch (error) {
      if (error instanceof StediApiError && error.retryable) {
        return {
          status: 'failed',
          redactedRequest,
          errorMessage: error.message,
          isTerminalError: false,
        }
      }
      throw error
    }

    const rawResponse = response as Record<string, unknown>
    if (isStediPayerDown(response)) {
      return {
        status: 'failed',
        externalId: response.controlNumber || response.eligibilitySearchId || null,
        rawResponse,
        redactedRequest,
        errorMessage:
          response.errors?.map((e) => e.description || e.code).filter(Boolean).join('; ') ||
          'Payer connectivity error',
        isTerminalError: false,
      }
    }

    const summary = parseStediEligibilityResponse(response)
    const isTerminalError = summary.eligibilityStatus === 'error'
    return {
      status: isTerminalError ? 'failed' : 'complete',
      externalId: response.controlNumber || response.eligibilitySearchId || null,
      summary,
      rawResponse,
      redactedRequest,
      isTerminalError,
      errorMessage: isTerminalError
        ? summary.validationMessages.join('; ') || 'Eligibility check failed'
        : undefined,
    }
  },

  async searchPayers(practiceId: string, query?: string): Promise<PayerSearchResult[]> {
    const config = await getStediIntegrationConfig(practiceId)
    return searchStediPayers(config, query)
  },
}
