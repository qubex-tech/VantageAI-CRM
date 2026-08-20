import {
  getAvailityIntegrationConfig,
  isCoverageInProgress,
  mapToCoverageInquiryRequest,
  parseEligibilityResponse,
  redactCoverageRequest,
  searchAvailityPayers,
  submitCoverageInquiry,
} from '@/lib/availity'
import type {
  CanonicalEligibilityRequest,
  CanonicalEligibilityResult,
  ClearinghouseAdapter,
  PayerSearchResult,
} from './types'

export const availityAdapter: ClearinghouseAdapter = {
  vendorKey: 'availity',
  displayName: 'Availity',
  capabilities: { asyncPoll: true, payerSearch: true },

  async isConfigured(practiceId: string) {
    try {
      const config = await getAvailityIntegrationConfig(practiceId)
      return Boolean(config.isActive && (config.useMockResponses || (config.clientId && config.clientSecret)))
    } catch {
      return false
    }
  },

  async checkEligibility(input: CanonicalEligibilityRequest): Promise<CanonicalEligibilityResult> {
    const config = await getAvailityIntegrationConfig(input.practiceId)
    const request = mapToCoverageInquiryRequest({
      patient: {
        firstName: input.patientFirstName,
        lastName: input.patientLastName,
        dateOfBirth: input.patientBirthDate,
        state: input.patientState,
        gender: input.patientGender,
      },
      policy: {
        memberId: input.memberId,
        groupNumber: input.groupNumber,
        subscriberIsPatient: input.subscriberIsPatient,
        relationshipToPatient: input.relationshipToPatient,
      },
      payerId: input.payerId,
      providerNpi: input.providerNpi,
      serviceType: input.serviceType,
      providerTaxId: input.providerTaxId,
    })

    const submission = await submitCoverageInquiry(config, request)
    const rawResponse = submission as Record<string, unknown>
    const redactedRequest = redactCoverageRequest(request)

    if (isCoverageInProgress(submission)) {
      return {
        status: 'in_progress',
        externalId: submission.id || null,
        statusCode: submission.statusCode ? String(submission.statusCode) : null,
        rawResponse,
        redactedRequest,
      }
    }

    const summary = parseEligibilityResponse(submission)
    const isTerminalError = summary.eligibilityStatus === 'error'
    return {
      status: isTerminalError ? 'failed' : 'complete',
      externalId: submission.id || null,
      statusCode: submission.statusCode ? String(submission.statusCode) : null,
      summary,
      rawResponse,
      redactedRequest,
      isTerminalError,
      errorMessage: isTerminalError
        ? summary.validationMessages.join('; ') || 'Availity eligibility check failed'
        : undefined,
    }
  },

  async searchPayers(practiceId: string, query?: string): Promise<PayerSearchResult[]> {
    const config = await getAvailityIntegrationConfig(practiceId)
    const payers = await searchAvailityPayers(config, query)
    return payers.map((p) => ({
      payerId: p.payerId,
      name: p.displayName || p.name || p.payerId,
    }))
  },
}
