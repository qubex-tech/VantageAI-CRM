import type { PaginationParams } from '../models/common'
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../models/common'

export function normalizePaginationParams(params?: PaginationParams, enterprise = false): PaginationParams {
  const maxLimit = enterprise ? 1000 : MAX_PAGE_LIMIT
  const limit = params?.Limit ?? DEFAULT_PAGE_LIMIT
  return {
    Limit: Math.min(Math.max(1, limit), maxLimit),
    Offset: Math.max(0, params?.Offset ?? 0),
  }
}

export type PaginatedFetcher<T> = (params: PaginationParams) => Promise<T[]>

export async function fetchAllPages<T>(
  fetchPage: PaginatedFetcher<T>,
  options: { limit?: number; maxPages?: number; enterprise?: boolean } = {}
): Promise<T[]> {
  const pageLimit = options.limit ?? DEFAULT_PAGE_LIMIT
  const maxPages = options.maxPages ?? 1000
  const all: T[] = []
  let offset = 0
  let page = 0

  while (page < maxPages) {
    const batch = await fetchPage(
      normalizePaginationParams({ Limit: pageLimit, Offset: offset }, options.enterprise)
    )
    all.push(...batch)
    if (batch.length < pageLimit) break
    offset += pageLimit
    page += 1
  }

  return all
}
