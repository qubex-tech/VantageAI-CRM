import { computeReadiness } from '@/lib/mcp/readiness'

export interface EligibilityReadinessResult {
  ready: boolean
  missingFields: string[]
  warnings: string[]
}

export function computeEligibilityReadiness(params: {
  policy: Parameters<typeof computeReadiness>[0] & { availityPayerId?: string | null }
  patient: Parameters<typeof computeReadiness>[1]
  providerNpi?: string | null
  payerId?: string | null
  payerIdField?: string
  providerOrganizationName?: string | null
  requireOrganizationName?: boolean
}): EligibilityReadinessResult {
  const base = computeReadiness(params.policy, params.patient)
  const missingFields = base.missing_fields.map((f) => f.field)
  const warnings = base.warnings.map((w) => `${w.field}: ${w.reason}`)

  const payerId = params.payerId ?? params.policy.availityPayerId
  if (!payerId?.trim()) {
    missingFields.push(params.payerIdField || 'policy.clearinghousePayerId')
  }
  if (!params.providerNpi?.trim()) {
    missingFields.push('practice.providerNpi')
  }
  if (params.requireOrganizationName && !params.providerOrganizationName?.trim()) {
    missingFields.push('practice.providerOrganizationName')
  }

  return {
    ready: missingFields.length === 0,
    missingFields,
    warnings,
  }
}
