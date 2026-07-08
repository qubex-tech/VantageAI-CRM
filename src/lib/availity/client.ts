import type { AvailityIntegrationConfig } from './types'

type TokenCacheEntry = {
  accessToken: string
  expiresAtMs: number
}

const tokenCache = new Map<string, TokenCacheEntry>()

export class AvailityApiError extends Error {
  statusCode: number
  userMessage?: string
  developerMessage?: string
  errors?: Array<{ field?: string; errorMessage?: string }>

  constructor(params: {
    message: string
    statusCode: number
    userMessage?: string
    developerMessage?: string
    errors?: Array<{ field?: string; errorMessage?: string }>
  }) {
    super(params.message)
    this.name = 'AvailityApiError'
    this.statusCode = params.statusCode
    this.userMessage = params.userMessage
    this.developerMessage = params.developerMessage
    this.errors = params.errors
  }
}

async function fetchAccessToken(config: AvailityIntegrationConfig): Promise<string> {
  const cacheKey = `${config.practiceId}:${config.environment}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAtMs > Date.now() + 30_000) {
    return cached.accessToken
  }

  if (!config.clientId || !config.clientSecret) {
    throw new AvailityApiError({
      message: 'Availity client credentials are not configured',
      statusCode: 401,
    })
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: config.oauthScope,
  })

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const json = (await response.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!response.ok || !json.access_token) {
    throw new AvailityApiError({
      message: json.error_description || json.error || 'Failed to obtain Availity access token',
      statusCode: response.status,
      developerMessage: JSON.stringify(json),
    })
  }

  const expiresInSec = typeof json.expires_in === 'number' ? json.expires_in : 300
  tokenCache.set(cacheKey, {
    accessToken: json.access_token,
    expiresAtMs: Date.now() + expiresInSec * 1000,
  })

  return json.access_token
}

export async function availityRequest<T>(params: {
  config: AvailityIntegrationConfig
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  query?: Record<string, string | string[] | undefined>
  formBody?: Record<string, string | string[] | undefined>
  mockScenarioId?: string
}): Promise<T> {
  const { config, method, path, query, formBody, mockScenarioId } = params

  if (config.useMockResponses) {
    const { handleMockAvailityRequest } = await import('./mock-client')
    return handleMockAvailityRequest<T>({ method, path, query, formBody, mockScenarioId })
  }

  const accessToken = await fetchAccessToken(config)
  const url = new URL(path.startsWith('http') ? path : `${config.apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, item)
      } else {
        url.searchParams.set(key, value)
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  }

  if (mockScenarioId) {
    headers['X-Api-Mock-Scenario-ID'] = mockScenarioId
  }

  let body: string | undefined
  if (formBody) {
    const paramsBody = new URLSearchParams()
    for (const [key, value] of Object.entries(formBody)) {
      if (value === undefined) continue
      if (Array.isArray(value)) {
        for (const item of value) paramsBody.append(key, item)
      } else {
        paramsBody.set(key, value)
      }
    }
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = paramsBody.toString()
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body,
  })

  if (response.status === 204) {
    return {} as T
  }

  const json = (await response.json().catch(() => ({}))) as T & {
    userMessage?: string
    developerMessage?: string
    statusCode?: number
    errors?: Array<{ field?: string; errorMessage?: string }>
  }

  if (!response.ok) {
    throw new AvailityApiError({
      message:
        json.userMessage ||
        json.developerMessage ||
        `Availity API request failed (${response.status})`,
      statusCode: response.status,
      userMessage: json.userMessage,
      developerMessage: json.developerMessage,
      errors: json.errors,
    })
  }

  return json
}
