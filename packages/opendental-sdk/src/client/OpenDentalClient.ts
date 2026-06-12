import { buildAuthorizationHeader, validateCredentials } from '../auth/authorization'
import {
  mapHttpStatusToError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  UnexpectedResponseError,
} from '../errors'
import { getLogger } from '../logging/logger'
import type { ApiResponse, ClientConfig, RequestOptions } from '../models/common'
import { buildUrl, interpolatePath, resolveEndpointChain } from './endpoints'
import { isRetryableStatus, parseRetryAfterMs, withRetry } from './retry'

export class OpenDentalClient {
  private readonly config: Required<Pick<ClientConfig, 'timeoutMs' | 'maxRetries'>> & ClientConfig
  private readonly endpointChain: string[]
  private activeBaseUrl: string

  constructor(config: ClientConfig) {
    validateCredentials(config.credentials)
    this.config = {
      timeoutMs: 10000,
      maxRetries: 3,
      ...config,
    }
    this.endpointChain = resolveEndpointChain(config.baseUrl, config.fallbackBaseUrls)
    this.activeBaseUrl = this.endpointChain[0]
  }

  getActiveBaseUrl(): string {
    return this.activeBaseUrl
  }

  getPracticeId(): string | undefined {
    return this.config.practiceId
  }

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.request<T>('GET', path, options)
    return response.data
  }

  async post<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, options)
  }

  async put<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.request<T>('PUT', path, options)
    return response.data
  }

  async delete(path: string, options: RequestOptions = {}): Promise<void> {
    await this.request<void>('DELETE', path, options)
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const logger = getLogger()
    const pathParams = extractPathParams(path)
    const resolvedPath = pathParams ? interpolatePath(path, pathParams.params) : path
    const queryParams = { ...options.params, ...pathParams?.query }

    const execute = async (attempt: number): Promise<ApiResponse<T>> => {
      let lastNetworkError: unknown
      for (const baseUrl of this.endpointChain) {
        const url = buildUrl(baseUrl, resolvedPath, queryParams)
        const started = Date.now()
        try {
          const response = await this.fetchWithTimeout(url, method, options)
          this.activeBaseUrl = baseUrl

          logger.info('Open Dental API request completed', {
            practiceId: this.config.practiceId,
            connectionId: this.config.connectionId,
            method,
            path: resolvedPath,
            status: response.status,
            durationMs: Date.now() - started,
            attempt,
          })

          if (!response.ok) {
            const errorBody = await safeReadText(response)
            if (response.status === 429) {
              throw new RateLimitError(
                errorBody || 'Rate limit exceeded',
                parseRetryAfterMs(response.headers),
                { status: response.status, body: errorBody }
              )
            }
            throw mapHttpStatusToError(
              response.status,
              errorBody || `Open Dental API error: ${response.status}`,
              { status: response.status, body: errorBody }
            )
          }

          const data = await parseResponseBody<T>(response, method)
          return {
            data,
            status: response.status,
            headers: response.headers,
            location: response.headers.get('location') ?? undefined,
          }
        } catch (error) {
          if (error instanceof RateLimitError || (error instanceof Error && 'status' in error && !isNetworkError(error))) {
            throw error
          }
          lastNetworkError = error
          logger.warn('Open Dental endpoint attempt failed, trying fallback', {
            practiceId: this.config.practiceId,
            baseUrl,
            method,
            path: resolvedPath,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
      throw lastNetworkError instanceof Error
        ? new NetworkError(lastNetworkError.message, lastNetworkError)
        : new NetworkError('All endpoint attempts failed')
    }

    if (options.skipRetry) {
      return execute(0)
    }

    return withRetry(execute, {
      maxRetries: this.config.maxRetries,
      baseDelayMs: 500,
      maxDelayMs: 15000,
      permissionTier: this.config.permissionTier,
    })
  }

  private async fetchWithTimeout(
    url: string,
    method: string,
    options: RequestOptions
  ): Promise<Response> {
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, {
        method,
        headers: {
          Authorization: buildAuthorizationHeader(this.config.credentials),
          Accept: 'application/json',
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`Request timed out after ${timeoutMs}ms`)
      }
      throw new NetworkError(error instanceof Error ? error.message : 'Network request failed', error)
    } finally {
      clearTimeout(timeout)
    }
  }
}

function isNetworkError(error: unknown): boolean {
  return error instanceof NetworkError || error instanceof TimeoutError
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

async function parseResponseBody<T>(response: Response, method: string): Promise<T> {
  if (method === 'DELETE' || response.status === 204) {
    return undefined as T
  }
  const text = await response.text()
  if (!text) {
    return undefined as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new UnexpectedResponseError('Failed to parse JSON response', response.status, { body: text.slice(0, 200) })
  }
}

function extractPathParams(path: string): { params: Record<string, string | number>; query?: Record<string, string | number> } | null {
  if (!path.includes('{')) return null
  return null
}

export function createClientFromContext(context: import('../practice/types').PracticeContext, developerKey?: string): OpenDentalClient {
  return new OpenDentalClient({
    credentials: {
      developerKey: developerKey ?? context.credentials.developerKey,
      customerKey: context.credentials.customerKey,
    },
    baseUrl: context.baseUrl,
    fallbackBaseUrls: context.fallbackBaseUrls,
    apiMode: context.apiMode,
    practiceId: context.practiceId,
    connectionId: context.connectionId,
  })
}
