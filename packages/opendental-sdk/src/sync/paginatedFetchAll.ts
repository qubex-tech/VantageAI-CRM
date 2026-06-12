import type { PaginationParams } from '../models/common'
import { fetchAllPages } from '../client/pagination'

export type ListFetcher<T> = (params: PaginationParams) => Promise<T[]>

export async function paginatedFetchAll<T>(
  fetchPage: ListFetcher<T>,
  options?: { limit?: number; maxPages?: number; enterprise?: boolean }
): Promise<T[]> {
  return fetchAllPages(fetchPage, options)
}

export async function fetchAllWithOffset<T>(
  listFn: (params: Record<string, string | number | boolean | undefined | null>) => Promise<T[]>,
  baseParams: Record<string, string | number | boolean | undefined | null> = {},
  options?: { limit?: number; maxPages?: number }
): Promise<T[]> {
  const limit = options?.limit ?? 100
  const maxPages = options?.maxPages ?? 1000
  const all: T[] = []
  let offset = 0

  for (let page = 0; page < maxPages; page++) {
    const batch = await listFn({ ...baseParams, Limit: limit, Offset: offset })
    all.push(...batch)
    if (batch.length < limit) break
    offset += limit
  }

  return all
}
