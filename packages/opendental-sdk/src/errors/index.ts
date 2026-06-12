export class OpenDentalError extends Error {
  readonly code: string
  readonly status?: number
  readonly details?: unknown

  constructor(message: string, code = 'OPEN_DENTAL_ERROR', status?: number, details?: unknown) {
    super(message)
    this.name = 'OpenDentalError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export class AuthenticationError extends OpenDentalError {
  constructor(message = 'Authentication failed', details?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', 401, details)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends OpenDentalError {
  constructor(message = 'Authorization failed', details?: unknown) {
    super(message, 'AUTHORIZATION_ERROR', 403, details)
    this.name = 'AuthorizationError'
  }
}

export class ValidationError extends OpenDentalError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationError'
  }
}

export class RateLimitError extends OpenDentalError {
  readonly retryAfterMs?: number

  constructor(message = 'Rate limit exceeded', retryAfterMs?: number, details?: unknown) {
    super(message, 'RATE_LIMIT_ERROR', 429, details)
    this.name = 'RateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

export class TimeoutError extends OpenDentalError {
  constructor(message = 'Request timed out', details?: unknown) {
    super(message, 'TIMEOUT_ERROR', 408, details)
    this.name = 'TimeoutError'
  }
}

export class NetworkError extends OpenDentalError {
  constructor(message = 'Network failure', details?: unknown) {
    super(message, 'NETWORK_ERROR', undefined, details)
    this.name = 'NetworkError'
  }
}

export class UnexpectedResponseError extends OpenDentalError {
  constructor(message = 'Unexpected API response', status?: number, details?: unknown) {
    super(message, 'UNEXPECTED_RESPONSE', status, details)
    this.name = 'UnexpectedResponseError'
  }
}

export function mapHttpStatusToError(status: number, message: string, details?: unknown): OpenDentalError {
  if (status === 401) return new AuthenticationError(message, details)
  if (status === 403) return new AuthorizationError(message, details)
  if (status === 400) return new ValidationError(message, details)
  if (status === 429) return new RateLimitError(message, undefined, details)
  if (status === 408) return new TimeoutError(message, details)
  if (status >= 500) return new OpenDentalError(message, 'API_FAILURE', status, details)
  return new OpenDentalError(message, 'API_FAILURE', status, details)
}
