import type { PayerSearchResult } from '@/lib/eligibility/clearinghouse/types'
import { stediRequest } from './client'
import type { StediIntegrationConfig } from './types'

interface StediPayerSearchResponse {
  items?: Array<{
    payer?: {
      stediId?: string
      displayName?: string
      primaryPayerId?: string
      aliases?: string[]
      names?: string[]
      transactionSupport?: { eligibilityCheck?: string }
    }
  }>
  nextPageToken?: string
}

export async function searchStediPayers(
  config: StediIntegrationConfig,
  query?: string
): Promise<PayerSearchResult[]> {
  const result = await stediRequest<StediPayerSearchResponse>({
    config,
    method: 'GET',
    path: '/payers/search',
    query: {
      query: query?.trim() || undefined,
      eligibilityCheck: 'EITHER',
      pageSize: '50',
    },
  })

  const payers: PayerSearchResult[] = []
  for (const item of result.items || []) {
    const payer = item.payer
    if (!payer) continue
    const payerId = payer.primaryPayerId || payer.stediId
    if (!payerId) continue
    payers.push({
      payerId,
      name: payer.displayName || payer.names?.[0] || payerId,
      aliases: payer.aliases,
      eligibilitySupport: payer.transactionSupport?.eligibilityCheck,
    })
  }
  return payers
}
