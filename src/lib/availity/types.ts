import type { RheumEligibilityPacket } from '@/lib/eligibility/rheum-packet'

export type AvailityEnvironment = 'demo' | 'production'

export interface AvailityIntegrationConfig {
  practiceId: string
  clientId: string | null
  clientSecret: string | null
  environment: AvailityEnvironment
  apiBaseUrl: string
  tokenUrl: string
  defaultProviderNpi: string | null
  defaultProviderTaxId: string | null
  defaultServiceType: string
  submitterId: string | null
  submitterStateCode: string | null
  useMockResponses: boolean
  isActive: boolean
  oauthScope: string
}

export interface CoverageInquiryRequest {
  payerId: string
  memberId: string
  patientFirstName: string
  patientLastName: string
  patientBirthDate: string
  providerNpi: string
  serviceType: string
  groupNumber?: string
  patientState?: string
  patientGender?: string
  subscriberRelationship?: string
  providerTaxId?: string
  submitterId?: string
  asOfDate?: string
}

export interface AvailityCoverageRecord {
  id?: string
  status?: string
  statusCode?: string
  etaDate?: string
  asOfDate?: string
  payer?: {
    payerId?: string
    name?: string
    responsePayerId?: string
    responseName?: string
  }
  patient?: Record<string, unknown>
  subscriber?: Record<string, unknown>
  plans?: AvailityPlan[]
  validationMessages?: Array<{ field?: string; code?: string; errorMessage?: string }>
  [key: string]: unknown
}

export interface AvailityPlan {
  status?: string
  statusCode?: string
  groupNumber?: string
  groupName?: string
  description?: string
  insuranceType?: string
  insuranceTypeCode?: string
  eligibilityStartDate?: string
  eligibilityEndDate?: string
  coverageStartDate?: string
  coverageEndDate?: string
  benefits?: Array<{
    name?: string
    type?: string
    status?: string
    statusCode?: string
    amounts?: Record<string, unknown>
  }>
  [key: string]: unknown
}

export interface ParsedEligibilitySummary {
  eligibilityStatus: 'active' | 'inactive' | 'unknown' | 'error'
  planStatus?: string
  payerName?: string
  payerId?: string
  groupNumber?: string
  planName?: string
  /** Insurance type string from payer when available (e.g. PPO / HMO). */
  planType?: string
  coverageStartDate?: string
  coverageEndDate?: string
  eligibilityStartDate?: string
  eligibilityEndDate?: string
  benefits: Array<{ name: string; status?: string; detail?: string }>
  validationMessages: string[]
  rawPlanCount: number
  /** Lonestar-shaped OV / specialty verification packet */
  rheum?: RheumEligibilityPacket
  /** Full clearinghouse 271 snapshot for the insurance UI */
  coverageDetail?: EligibilityCoverageDetail
}

export interface EligibilityMoneyPair {
  total?: string
  remaining?: string
}

export interface EligibilityServiceCost {
  services: string
  amount: string
  network: 'INN' | 'OON'
}

export interface EligibilityCoverageDetail {
  payerName?: string
  payerId?: string
  planName?: string
  planDescription?: string
  planType?: string
  insuranceType?: string
  planNumber?: string
  groupNumber?: string
  coverageLevel?: string
  memberStatus?: string
  coverageStartDate?: string
  coverageEndDate?: string
  eligibilityStartDate?: string
  eligibilityEndDate?: string
  serviceDate?: string
  referenceNumber?: string
  coveredServices?: string[]
  subscriber?: {
    firstName?: string
    lastName?: string
    memberId?: string
    dateOfBirth?: string
    gender?: string
    address?: string
    groupNumber?: string
    planNumber?: string
  }
  payerCorrespondence?: {
    name?: string
    address?: string
  }
  inn?: {
    deductible?: EligibilityMoneyPair
    oop?: EligibilityMoneyPair
    officeCopay?: string
    officeCoinsurance?: string
  }
  oon?: {
    deductible?: EligibilityMoneyPair
    oop?: EligibilityMoneyPair
    officeCopay?: string
    officeCoinsurance?: string
  }
  copays?: EligibilityServiceCost[]
  coinsuranceLines?: EligibilityServiceCost[]
}

export const TERMINAL_COMPLETE_STATUS_CODES = new Set(['3', '4'])
export const TERMINAL_ERROR_STATUS_CODES = new Set(['7', '13', '14', '15', '19'])

export function isCoverageInProgress(record: AvailityCoverageRecord): boolean {
  const code = String(record.statusCode ?? '')
  const status = String(record.status ?? '').toLowerCase()
  if (TERMINAL_COMPLETE_STATUS_CODES.has(code)) return false
  if (TERMINAL_ERROR_STATUS_CODES.has(code)) return false
  if (status.includes('complete')) return false
  if (status.includes('error')) return false
  return code === '0' || status.includes('progress') || status.includes('retry')
}
