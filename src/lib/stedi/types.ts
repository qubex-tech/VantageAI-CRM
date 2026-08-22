export type StediEnvironment = 'test' | 'production'

export interface StediIntegrationConfig {
  practiceId: string
  apiKey: string | null
  environment: StediEnvironment
  apiBaseUrl: string
  useMockResponses: boolean
  isActive: boolean
}

export interface StediEligibilityRequest {
  tradingPartnerServiceId: string
  encounter?: {
    serviceTypeCodes?: string[]
  }
  provider: {
    organizationName?: string
    firstName?: string
    lastName?: string
    npi?: string
    taxId?: string
  }
  subscriber: {
    firstName?: string
    lastName?: string
    memberId?: string
    dateOfBirth?: string
    gender?: string
    groupNumber?: string
  }
  dependents?: Array<{
    firstName?: string
    lastName?: string
    dateOfBirth?: string
    gender?: string
    individualRelationshipCode?: string
  }>
}

export interface StediBenefitInformation {
  code?: string
  name?: string
  serviceTypeCodes?: string[]
  serviceTypes?: string[]
  insuranceType?: string
  insuranceTypeCode?: string
  planCoverage?: string
  coverageLevel?: string
  coverageLevelCode?: string
  timeQualifier?: string
  timeQualifierCode?: string
  quantityQualifier?: string
  quantityQualifierCode?: string
  benefitAmount?: string
  benefitPercent?: string
  inPlanNetworkIndicator?: string
  inPlanNetworkIndicatorCode?: string
  authOrCertIndicator?: string
  additionalInformation?: Array<{ description?: string }>
  benefitsRelatedEntity?: StediRelatedEntity
  benefitsRelatedEntities?: StediRelatedEntity[]
  [key: string]: unknown
}

export interface StediRelatedEntity {
  entityName?: string
  entityType?: string
  entityIdentifier?: string
  address?: {
    address1?: string
    city?: string
    state?: string
    postalCode?: string
  }
}

export interface StediEligibilityResponse {
  controlNumber?: string
  tradingPartnerServiceId?: string
  eligibilitySearchId?: string
  payer?: {
    name?: string
    entityName?: string
    payorIdentification?: string
    entityIdentificationValue?: string
  }
  subscriber?: {
    firstName?: string
    lastName?: string
    memberId?: string
    groupNumber?: string
    planNumber?: string
    dateOfBirth?: string
    gender?: string
    address?: {
      address1?: string
      city?: string
      state?: string
      postalCode?: string
    }
  }
  planInformation?: {
    groupNumber?: string
    groupDescription?: string
    planNumber?: string
  }
  planDateInformation?: {
    planBegin?: string
    planEnd?: string
    eligibilityBegin?: string
    eligibilityEnd?: string
    service?: string
  }
  planStatus?: Array<{
    status?: string
    statusCode?: string
    planDetails?: string
    serviceTypeCodes?: string[]
  }>
  benefitsInformation?: StediBenefitInformation[]
  errors?: Array<{
    field?: string
    code?: string
    description?: string
    followupAction?: string
  }>
  [key: string]: unknown
}

export const STEDI_PAYER_DOWN_CODES = new Set(['42', '79', '80'])
