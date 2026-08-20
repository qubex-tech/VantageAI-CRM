import type { StediEligibilityResponse, StediIntegrationConfig } from './types'

export class StediApiError extends Error {
  statusCode: number
  errorCode?: string
  retryable: boolean

  constructor(params: {
    message: string
    statusCode: number
    errorCode?: string
    retryable?: boolean
  }) {
    super(params.message)
    this.name = 'StediApiError'
    this.statusCode = params.statusCode
    this.errorCode = params.errorCode
    this.retryable = params.retryable ?? (params.statusCode === 429 || params.statusCode >= 500)
  }
}

export async function stediRequest<T>(params: {
  config: StediIntegrationConfig
  method: 'GET' | 'POST'
  path: string
  query?: Record<string, string | undefined>
  jsonBody?: unknown
}): Promise<T> {
  const { config, method, path, query, jsonBody } = params

  if (config.useMockResponses) {
    const { handleMockStediRequest } = await import('./mock-client')
    return handleMockStediRequest<T>({ method, path, query, jsonBody })
  }

  if (!config.apiKey?.trim()) {
    throw new StediApiError({
      message: 'Eligibility API key is not configured for this practice',
      statusCode: 401,
    })
  }

  const url = new URL(
    path.startsWith('http')
      ? path
      : `${config.apiBaseUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`
  )
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) url.searchParams.set(key, value)
    }
  }

  const headers: Record<string, string> = {
    Authorization: config.apiKey,
    Accept: 'application/json',
  }
  let body: string | undefined
  if (jsonBody !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(jsonBody)
  }

  const response = await fetch(url.toString(), { method, headers, body })
  const json = (await response.json().catch(() => ({}))) as T & {
    error?: string
    message?: string
    code?: string
    errors?: Array<{ code?: string; description?: string; message?: string }>
  }

  if (!response.ok) {
    const nested = json.errors?.[0]
    throw new StediApiError({
      message:
        json.message ||
        nested?.description ||
        nested?.message ||
        json.error ||
        `Eligibility request failed (${response.status})`,
      statusCode: response.status,
      errorCode: json.code || nested?.code,
      retryable: response.status === 429 || response.status >= 500,
    })
  }

  return json
}

export async function submitStediEligibilityCheck(
  config: StediIntegrationConfig,
  body: unknown
): Promise<StediEligibilityResponse> {
  return stediRequest<StediEligibilityResponse>({
    config,
    method: 'POST',
    path: '/change/medicalnetwork/eligibility/v3',
    jsonBody: body,
  })
}
