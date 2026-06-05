import { describe, expect, it } from 'vitest'
import {
  getTelnyxWebhookPublicKey,
  isTelnyxWebhookVerificationRequired,
  verifyTelnyxWebhookTimestamp,
} from '@/lib/telnyx-webhook'

describe('telnyx webhook verification helpers', () => {
  it('prefers integration public key over env', () => {
    const previous = process.env.TELNYX_WEBHOOK_PUBLIC_KEY
    process.env.TELNYX_WEBHOOK_PUBLIC_KEY = 'env-key'
    expect(getTelnyxWebhookPublicKey('practice-key')).toBe('practice-key')
    process.env.TELNYX_WEBHOOK_PUBLIC_KEY = previous
  })

  it('requires verification when a public key is configured', () => {
    const previous = process.env.TELNYX_WEBHOOK_PUBLIC_KEY
    process.env.TELNYX_WEBHOOK_PUBLIC_KEY = 'abc123'
    process.env.TELNYX_WEBHOOK_VERIFY = 'true'
    expect(isTelnyxWebhookVerificationRequired()).toBe(true)
    process.env.TELNYX_WEBHOOK_PUBLIC_KEY = previous
  })

  it('rejects stale timestamps', () => {
    const nowMs = Date.UTC(2026, 4, 29, 12, 0, 0)
    const staleTimestamp = String(Math.floor(nowMs / 1000) - 600)
    expect(verifyTelnyxWebhookTimestamp(staleTimestamp, 300, nowMs)).toBe(false)
  })

  it('accepts fresh timestamps', () => {
    const nowMs = Date.UTC(2026, 4, 29, 12, 0, 0)
    const freshTimestamp = String(Math.floor(nowMs / 1000) - 30)
    expect(verifyTelnyxWebhookTimestamp(freshTimestamp, 300, nowMs)).toBe(true)
  })
})
