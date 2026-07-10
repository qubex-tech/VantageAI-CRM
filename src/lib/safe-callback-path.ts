/**
 * Validates post-login redirect targets: same-origin relative paths only.
 * Only the path segment is checked for `://` so query values may contain URLs.
 */
export function isSafeInternalCallbackPath(url: string): boolean {
  if (!url.startsWith('/')) return false
  if (url.startsWith('//')) return false
  const q = url.indexOf('?')
  const pathOnly = q === -1 ? url : url.slice(0, q)
  if (pathOnly.includes('://')) return false
  return true
}

/**
 * Normalize post-login destinations. `/` is a valid path but must not be used as
 * callbackUrl — middleware sends unauthenticated `/` back to login and loops.
 */
export function resolvePostLoginPath(url: string | null | undefined): string {
  const raw = url && isSafeInternalCallbackPath(url) ? url : '/dashboard'
  const q = raw.indexOf('?')
  const pathOnly = q === -1 ? raw : raw.slice(0, q)
  if (pathOnly === '/' || pathOnly === '') return '/dashboard'
  return raw
}
