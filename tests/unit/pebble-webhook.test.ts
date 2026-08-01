import { describe, expect, it } from 'vitest'
import {
  extractPebbleWebhookToken,
  generatePebbleWebhookSecret,
  isOpenAriaSessionStatus,
  matchPebbleWebhookPractice,
} from '@/lib/pebble-webhook'

describe('extractPebbleWebhookToken', () => {
  it('reads Bearer Authorization', () => {
    const headers = new Headers({ authorization: 'Bearer peb_abc123' })
    expect(extractPebbleWebhookToken(headers)).toBe('peb_abc123')
  })

  it('reads X-Pebble-Token', () => {
    const headers = new Headers({ 'x-pebble-token': 'tok-1' })
    expect(extractPebbleWebhookToken(headers)).toBe('tok-1')
  })

  it('reads legacy X-Widget-Token', () => {
    const headers = new Headers({ 'x-widget-token': 'widget-9' })
    expect(extractPebbleWebhookToken(headers)).toBe('widget-9')
  })

  it('prefers Authorization Bearer over other headers', () => {
    const headers = new Headers({
      authorization: 'Bearer preferred',
      'x-pebble-token': 'other',
    })
    expect(extractPebbleWebhookToken(headers)).toBe('preferred')
  })

  it('returns null when no token header is present', () => {
    expect(extractPebbleWebhookToken(new Headers())).toBeNull()
  })
})

describe('matchPebbleWebhookPractice', () => {
  const candidates = [
    {
      id: 'cred-a',
      practiceId: 'practice-a',
      webhookSecret: 'secret-a',
      providerUserId: 'user-a',
      activeSessionId: null,
    },
    {
      id: 'cred-b',
      practiceId: 'practice-a',
      webhookSecret: 'secret-b',
      providerUserId: 'user-b',
      activeSessionId: 'session-1',
    },
  ]

  it('matches the provider credential with the shared secret', () => {
    const match = matchPebbleWebhookPractice('secret-b', candidates)
    expect(match?.practiceId).toBe('practice-a')
    expect(match?.providerUserId).toBe('user-b')
    expect(match?.activeSessionId).toBe('session-1')
  })

  it('returns null for wrong token', () => {
    expect(matchPebbleWebhookPractice('nope', candidates)).toBeNull()
  })

  it('returns null for blank token', () => {
    expect(matchPebbleWebhookPractice('', candidates)).toBeNull()
  })

  it('ignores blank secrets', () => {
    const match = matchPebbleWebhookPractice('secret-a', [
      {
        id: 'blank',
        practiceId: 'practice-x',
        webhookSecret: '   ',
        providerUserId: 'user-x',
        activeSessionId: null,
      },
      ...candidates,
    ])
    expect(match?.providerUserId).toBe('user-a')
  })
})

describe('generatePebbleWebhookSecret', () => {
  it('generates peb_ prefixed secrets', () => {
    const secret = generatePebbleWebhookSecret()
    expect(secret.startsWith('peb_')).toBe(true)
    expect(secret.length).toBeGreaterThan(20)
  })
})

describe('isOpenAriaSessionStatus', () => {
  it('accepts recording and ready_for_review', () => {
    expect(isOpenAriaSessionStatus('recording')).toBe(true)
    expect(isOpenAriaSessionStatus('ready_for_review')).toBe(true)
  })

  it('rejects signed and discarded', () => {
    expect(isOpenAriaSessionStatus('signed')).toBe(false)
    expect(isOpenAriaSessionStatus('discarded')).toBe(false)
  })
})
