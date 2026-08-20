export type PayerIdMap = Record<string, string>

function asPayerIdMap(value: unknown): PayerIdMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: PayerIdMap = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string' && raw.trim()) out[key] = raw.trim()
  }
  return out
}

export function getPayerIdForVendor(
  policy: {
    availityPayerId?: string | null
    clearinghousePayerIds?: unknown
  },
  vendorKey: string
): string | null {
  const map = asPayerIdMap(policy.clearinghousePayerIds)
  const fromMap = map[vendorKey]
  if (fromMap) return fromMap
  if (vendorKey === 'availity') {
    return policy.availityPayerId?.trim() || null
  }
  return null
}

export function upsertPayerIdMap(
  existing: unknown,
  vendorKey: string,
  payerId: string | null | undefined
): PayerIdMap {
  const map = asPayerIdMap(existing)
  const trimmed = payerId?.trim() || ''
  if (!trimmed) {
    delete map[vendorKey]
    return map
  }
  map[vendorKey] = trimmed
  return map
}
