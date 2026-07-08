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
}): EligibilityReadinessResult {
  const base = computeReadiness(params.policy, params.patient)
  const missingFields = base.missing_fields.map((f) => f.field)
  const warnings = base.warnings.map((w) => `${w.field}: ${w.reason}`)

  if (!params.policy.availityPayerId?.trim()) {
    missingFields.push('policy.availityPayerId')
  }
  if (!params.providerNpi?.trim()) {
    missingFields.push('practice.providerNpi')
  }

  return {
    ready: missingFields.length === 0,
    missingFields,
    warnings,
  }
}
