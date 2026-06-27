/** Decode JWT payload without verifying signature (client-side display / expiry only). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Returns true when the token is missing `exp` or is past expiry (60s skew). */
export function isJwtExpired(token: string, skewSeconds = 60): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload) return true
  const exp = payload.exp
  if (typeof exp !== 'number') return false
  return Date.now() / 1000 >= exp - skewSeconds
}
