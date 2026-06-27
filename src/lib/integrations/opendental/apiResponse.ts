/**
 * The SDK client returns create/update calls as an ApiResponse wrapper
 * ({ data, status, headers, location }) rather than the raw record. For POST
 * creates, Open Dental also returns the new id in the `location` header
 * (e.g. ".../appointments/55"). These helpers normalize both shapes.
 */
export function unwrapCreatedRecord(resp: unknown): {
  record: Record<string, unknown> | null
  location?: string
} {
  if (resp && typeof resp === 'object' && 'data' in (resp as Record<string, unknown>)) {
    const r = resp as { data?: unknown; location?: unknown }
    return {
      record: r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : null,
      location: typeof r.location === 'string' ? r.location : undefined,
    }
  }
  return {
    record: resp && typeof resp === 'object' ? (resp as Record<string, unknown>) : null,
  }
}

/** Extract a trailing numeric id from a Location header URL. */
export function numberFromLocation(location?: string): number | null {
  if (!location) return null
  const m = location.match(/(\d+)\s*$/)
  return m ? Number(m[1]) : null
}

/** Resolve a created record's numeric id from its body field or the Location header. */
export function resolveCreatedId(resp: unknown, idField: string): number | null {
  const { record, location } = unwrapCreatedRecord(resp)
  const fromBody = Number(record?.[idField])
  if (Number.isInteger(fromBody) && fromBody > 0) return fromBody
  return numberFromLocation(location)
}
