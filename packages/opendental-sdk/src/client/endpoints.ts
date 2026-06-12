export const REMOTE_BASE_URL = 'https://api.opendental.com/api/v1'
export const LOCAL_BASE_URL = 'http://localhost:30222/api/v1'
export const SERVICE_BASE_URL = 'http://localhost:30223/api/v1'

export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/g, '')
}

export function resolveEndpointChain(baseUrl: string, fallbackBaseUrls: string[] = []): string[] {
  const chain = [normalizeBaseUrl(baseUrl), ...fallbackBaseUrls.map(normalizeBaseUrl)]
  return [...new Set(chain.filter(Boolean))]
}

export function buildUrl(baseUrl: string, path: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${normalizeBaseUrl(baseUrl)}${normalizedPath}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

export function interpolatePath(path: string, params: Record<string, string | number>): string {
  return path.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key]
    if (value === undefined || value === null) {
      throw new Error(`Missing path parameter: ${key}`)
    }
    return encodeURIComponent(String(value))
  })
}
