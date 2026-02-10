/**
 * PHI minimization: mask sensitive values (member_id, group_number) by default.
 */
export function maskLast4(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  const s = String(value).trim()
  if (s.length <= 4) return '****'
  return `****${s.slice(-4)}`
}

export function maskZip(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  const s = String(value).trim()
  if (s.length <= 4) return '****'
  return `****${s.slice(-4)}`
}
