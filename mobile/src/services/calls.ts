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
  console.log('[calls] response: calls=', result?.calls?.length ?? 'undefined', 'debug=', (result as any)?.debug ?? 'none')
  return result
}

export async function fetchCall(id: string): Promise<CallDetailResponse> {
  return apiGet<CallDetailResponse>(ENDPOINTS.mobileCallById(id))
}

export async function markCallReviewed(id: string): Promise<void> {
  await apiPost(ENDPOINTS.mobileCallReview(id))
}
