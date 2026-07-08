import { availityRequest } from './client'
import type { AvailityIntegrationConfig } from './types'

export interface AvailityPayerSummary {
  payerId: string
  name?: string
  displayName?: string
}

export async function searchAvailityPayers(
  config: AvailityIntegrationConfig,
  query?: string
): Promise<AvailityPayerSummary[]> {
  const result = await availityRequest<{
    payers?: AvailityPayerSummary[]
    totalCount?: number
  }>({
    config,
    method: 'GET',
    path: '/availity-payer-list',
    query: {
      limit: '50',
      offset: '0',
      transactionType: '270',
    },
  })

  const payers = result.payers || []
  if (!query?.trim()) return payers

  const q = query.trim().toLowerCase()
  return payers.filter((payer) => {
    const haystack = [payer.payerId, payer.name, payer.displayName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
