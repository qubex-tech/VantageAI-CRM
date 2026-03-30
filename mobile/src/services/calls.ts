import { apiGet, apiPost } from './apiClient'
import { ENDPOINTS } from '@/constants/api'
import type { CallsResponse, CallDetailResponse } from '@/types'

export interface CallsFilter {
  limit?: number
  offset?: number
}

export async function fetchCalls(filter: CallsFilter = {}): Promise<CallsResponse> {
  return apiGet<CallsResponse>(ENDPOINTS.mobileCalls, filter as Record<string, unknown>)
}

export async function fetchCall(id: string): Promise<CallDetailResponse> {
  return apiGet<CallDetailResponse>(ENDPOINTS.mobileCallById(id))
}

export async function markCallReviewed(id: string): Promise<void> {
  await apiPost(ENDPOINTS.mobileCallReview(id))
}
