import { availityRequest } from './client'
import type { AvailityIntegrationConfig } from './types'

export async function getPayerEligibilityConfiguration(
  config: AvailityIntegrationConfig,
  payerId: string
): Promise<Record<string, unknown>> {
  return availityRequest<Record<string, unknown>>({
    config,
    method: 'GET',
    path: '/configurations',
    query: {
      type: '270',
      payerId,
    },
  })
}
