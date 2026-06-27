const DEV_FALLBACK = 'http://localhost:3000'

/** Resolved API base URL (no trailing slash). */
export function getApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')
  if (__DEV__) return DEV_FALLBACK
  return ''
}

export function isApiConfigured(): boolean {
  return getApiBaseUrl().length > 0
}

export function isLocalApiUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url)
}

/** True when the bundled API URL is safe for store builds. */
export function isProductionApiUrl(): boolean {
  const url = getApiBaseUrl()
  if (!url) return false
  return !isLocalApiUrl(url)
}

export function getConfigError(): string | null {
  if (__DEV__) return null

  const url = getApiBaseUrl()
  if (!url) {
    return 'EXPO_PUBLIC_API_URL was not set at build time. Configure it in EAS environment variables and rebuild.'
  }
  if (isLocalApiUrl(url)) {
    return 'This build points to a local development server. Set EXPO_PUBLIC_API_URL to your production backend URL and rebuild.'
  }
  return null
}
