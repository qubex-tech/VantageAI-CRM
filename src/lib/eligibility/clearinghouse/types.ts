import type { ParsedEligibilitySummary } from '@/lib/availity/types'

export interface CanonicalEligibilityRequest {
  practiceId: string
  payerId: string
  memberId: string
  patientFirstName: string
  patientLastName: string
  /** YYYY-MM-DD */
  patientBirthDate: string
  providerNpi: string
  providerOrganizationName?: string | null
  providerTaxId?: string | null
  serviceType: string
  /** When omitted, adapters send `serviceType` only. Stedi uses this list as `encounter.serviceTypeCodes`. */
  serviceTypeCodes?: string[]
  groupNumber?: string | null
  subscriberIsPatient: boolean
  subscriberFirstName?: string | null
  subscriberLastName?: string | null
  /** YYYY-MM-DD */
  subscriberDob?: string | null
  relationshipToPatient?: string | null
  patientGender?: string | null
  patientState?: string | null
  asOfDate?: string
}

export interface CanonicalEligibilityResult {
  status: 'complete' | 'in_progress' | 'failed'
  externalId?: string | null
  statusCode?: string | null
  summary?: ParsedEligibilitySummary
  rawResponse?: Record<string, unknown>
  redactedRequest?: Record<string, unknown>
  errorMessage?: string
  isTerminalError?: boolean
}

export interface PayerSearchResult {
  payerId: string
  name: string
  aliases?: string[]
  eligibilitySupport?: string
}

export interface ClearinghouseAdapter {
  vendorKey: string
  displayName: string
  capabilities: {
    asyncPoll: boolean
    payerSearch: boolean
  }
  isConfigured(practiceId: string): Promise<boolean>
  checkEligibility(input: CanonicalEligibilityRequest): Promise<CanonicalEligibilityResult>
  searchPayers(practiceId: string, query?: string): Promise<PayerSearchResult[]>
}

export interface PracticeEligibilityConfig {
  practiceId: string
  primaryVendorKey: string
  apiEnabled: boolean
  rpaEnabled: boolean
  voiceEnabled: boolean
  defaultProviderNpi: string | null
  defaultProviderTaxId: string | null
  defaultProviderOrgName: string | null
  defaultServiceType: string
  defaultServiceTypeCodes: string[]
}
