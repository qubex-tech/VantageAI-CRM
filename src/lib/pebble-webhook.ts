import { createHash, randomBytes, timingSafeEqual } from 'crypto'

export type PebbleWebhookSecretCandidate = {
  practiceId: string
  webhookSecret: string
  providerUserId: string | null
  activeSessionId: string | null
}

/** Sessions that can still accept Index dictation chunks */
const ACCEPTING_SESSION_STATUSES = [
  'recording',
  'uploading',
  'transcribing',
  'generating',
  'ready_for_review',
  'failed',
] as const

export function isOpenAriaSessionStatus(status: string): boolean {
  return (ACCEPTING_SESSION_STATUSES as readonly string[]).includes(status)
}

/**
 * Extract a shared webhook token from Pebble Index request headers.
 * Supports Authorization Bearer, X-Pebble-Token, and legacy X-Widget-Token.
 */
export function extractPebbleWebhookToken(headers: Headers): string | null {
  const auth = headers.get('authorization')?.trim()
  if (auth) {
    const bearer = auth.match(/^Bearer\s+(.+)$/i)
    if (bearer?.[1]?.trim()) return bearer[1].trim()
    // Some clients send the raw token in Authorization
    if (!auth.includes(' ')) return auth
  }

  const pebble = headers.get('x-pebble-token')?.trim()
  if (pebble) return pebble

  const widget = headers.get('x-widget-token')?.trim()
  if (widget) return widget

  return null
}

function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

/**
 * Match a bearer/shared token to a practice-scoped Pebble webhook secret.
 */
export function matchPebbleWebhookPractice(
  token: string,
  candidates: PebbleWebhookSecretCandidate[]
): PebbleWebhookSecretCandidate | null {
  const normalized = token?.trim()
  if (!normalized || candidates.length === 0) return null

  for (const candidate of candidates) {
    const secret = candidate.webhookSecret?.trim()
    if (!secret) continue
    if (safeEqualString(normalized, secret)) {
      return candidate
    }
  }

  return null
}

export function generatePebbleWebhookSecret(): string {
  return `peb_${randomBytes(32).toString('hex')}`
}

export function hashPebbleSecretPreview(secret: string): string {
  return createHash('sha256').update(secret).digest('hex').slice(0, 12)
}
