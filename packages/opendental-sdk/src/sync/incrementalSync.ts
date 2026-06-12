import type { OdDateTime } from '../models/common'

export type IncrementalListParams = {
  since: OdDateTime | string
  dateField?: string
  additionalParams?: Record<string, string | number | boolean | undefined | null>
}

export async function incrementalFetchSince<T extends Record<string, unknown>>(
  listFn: (params: Record<string, string | number | boolean | undefined | null>) => Promise<T[]>,
  options: IncrementalListParams
): Promise<T[]> {
  const dateField = options.dateField ?? 'DateTStamp'
  const params = {
    ...options.additionalParams,
    [dateField]: options.since,
  }
  return listFn(params)
}

export function filterByTimestampSince<T extends Record<string, unknown>>(
  items: T[],
  since: string,
  field = 'DateTStamp'
): T[] {
  return items.filter((item) => {
    const value = item[field]
    if (typeof value !== 'string') return false
    return value >= since
  })
}
