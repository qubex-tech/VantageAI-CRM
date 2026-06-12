import type { PermissionTier } from '../models/common'
import { RateLimitError } from '../errors'

export type RetryConfig = {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  permissionTier?: PermissionTier
}

const TIER_MIN_INTERVAL_MS: Partial<Record<PermissionTier, number>> = {
  ReadAll: 5000,
  Enterprise: 500,
  Comm: 1000,
  Documents: 1000,
  Queries: 1000,
  Appointments: 1000,
  InsuranceSimple: 1000,
  Insurance: 1000,
  Patients: 1000,
  Payments: 1000,
  PayPlans: 1000,
  ProcedureLogs: 1000,
  Setup: 1000,
  TextingASAP: 1000,
  AllOthers: 1000,
}

let lastRequestAt = 0

export function getMinIntervalMs(tier?: PermissionTier): number {
  if (!tier) return 1000
  return TIER_MIN_INTERVAL_MS[tier] ?? 1000
}

export async function enforceRateLimit(tier?: PermissionTier): Promise<void> {
  const minInterval = getMinIntervalMs(tier)
  const now = Date.now()
  const elapsed = now - lastRequestAt
  if (elapsed < minInterval) {
    await sleep(minInterval - elapsed)
  }
  lastRequestAt = Date.now()
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function computeBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const delay = baseDelayMs * Math.pow(2, attempt)
  return Math.min(delay, maxDelayMs)
}

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

export function parseRetryAfterMs(headers: Headers): number | undefined {
  const retryAfter = headers.get('retry-after')
  if (!retryAfter) return undefined
  const seconds = Number(retryAfter)
  if (!Number.isNaN(seconds)) return seconds * 1000
  const date = Date.parse(retryAfter)
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now())
  return undefined
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      await enforceRateLimit(config.permissionTier)
      return await fn(attempt)
    } catch (error) {
      lastError = error
      if (error instanceof RateLimitError) {
        const delay = error.retryAfterMs ?? computeBackoffDelay(attempt, config.baseDelayMs, config.maxDelayMs)
        await sleep(delay)
        continue
      }
      if (attempt >= config.maxRetries) break
      if (error instanceof Error && 'status' in error) {
        const status = (error as { status?: number }).status
        if (status && !isRetryableStatus(status)) break
      }
      await sleep(computeBackoffDelay(attempt, config.baseDelayMs, config.maxDelayMs))
    }
  }
  throw lastError
}

export function resetRateLimitState(): void {
  lastRequestAt = 0
}
