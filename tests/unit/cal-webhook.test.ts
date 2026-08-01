import { createHmac } from 'crypto'
import { describe, expect, it } from 'vitest'
import { matchCalWebhookPractice } from '@/lib/cal-webhook'

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

describe('matchCalWebhookPractice', () => {
  const body = JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: { id: 1 } })

  it('matches the practice whose webhook secret signed the payload', () => {
    const practiceId = matchCalWebhookPractice(body, sign(body, 'secret-b'), [
      { practiceId: 'practice-a', webhookSecret: 'secret-a' },
      { practiceId: 'practice-b', webhookSecret: 'secret-b' },
    ])
    expect(practiceId).toBe('practice-b')
  })

  it('returns null when signature does not match any practice', () => {
    const practiceId = matchCalWebhookPractice(body, sign(body, 'wrong'), [
      { practiceId: 'practice-a', webhookSecret: 'secret-a' },
    ])
    expect(practiceId).toBeNull()
  })

  it('returns null when signature is missing', () => {
    expect(
      matchCalWebhookPractice(body, '', [{ practiceId: 'practice-a', webhookSecret: 'secret-a' }])
    ).toBeNull()
  })

  it('ignores blank secrets', () => {
    const practiceId = matchCalWebhookPractice(body, sign(body, 'secret-a'), [
      { practiceId: 'practice-blank', webhookSecret: '   ' },
      { practiceId: 'practice-a', webhookSecret: 'secret-a' },
    ])
    expect(practiceId).toBe('practice-a')
  })
})
