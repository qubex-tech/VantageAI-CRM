import { apiGet, apiPost } from './apiClient'
import { ENDPOINTS, API_BASE_URL } from '@/constants/api'
import type { CallsResponse, CallDetailResponse } from '@/types'

export interface CallsFilter {
  limit?: number
  offset?: number
}

export async function fetchCalls(filter: CallsFilter = {}): Promise<CallsResponse> {
  console.log('[calls] fetching from', API_BASE_URL + ENDPOINTS.mobileCalls)
  const result = await apiGet<CallsResponse>(ENDPOINTS.mobileCalls, filter as Record<string, unknown>)

  // Sort newest-first client-side as a safety net (server also sorts but belt+suspenders)
  const calls = (result?.calls ?? []).slice().sort((a: any, b: any) => {
    const aTs = a.start_timestamp ?? a.startTimestamp ?? 0
    const bTs = b.start_timestamp ?? b.startTimestamp ?? 0
    return bTs - aTs
  })

  console.log(
    '[calls] response: calls=', calls.length,
    'newest=', calls[0]?.start_timestamp ?? 'n/a',
    'debug=', (result as any)?.debug ?? 'none'
  )
  return { ...result, calls }
}

export async function fetchCall(id: string): Promise<CallDetailResponse> {
  const url = API_BASE_URL + ENDPOINTS.mobileCallById(id)
  console.log('[calls] fetchCall url:', url)
  const result = await apiGet<CallDetailResponse>(ENDPOINTS.mobileCallById(id))
  console.log('[calls] fetchCall result:', { hasCall: !!result?.call, callStatus: result?.call?.call_status })
  return result
}

export async function markCallReviewed(id: string): Promise<void> {
  await apiPost(ENDPOINTS.mobileCallReview(id))
}
