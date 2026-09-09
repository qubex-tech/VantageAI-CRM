import { describe, expect, it } from 'vitest'
import {
  formatApidazeNumber,
  formatE164,
  isApidazeWebhookAuthorized,
  parseApidazeInboundParams,
  parseApidazeNumbersPayload,
  parseApidazeSendResponse,
} from '@/lib/apidaze'
import { selectSmsProvider } from '@/lib/sms'

describe('apidaze number formatting', () => {
  it('adds country code without plus for Apidaze', () => {
    expect(formatApidazeNumber('+15551234567')).toBe('15551234567')
    expect(formatApidazeNumber('5551234567')).toBe('15551234567')
    expect(formatApidazeNumber('15551234567')).toBe('15551234567')
  })

  it('stores numbers as E.164', () => {
    expect(formatE164('5551234567')).toBe('+15551234567')
    expect(formatE164('15551234567')).toBe('+15551234567')
  })
})

describe('apidaze payload parsers', () => {
  it('parses XML number lists', () => {
    const numbers = parseApidazeNumbersPayload(`
      <numbers>
        <number>14125551212</number>
        <number>14125558989</number>
      </numbers>
    `)
    expect(numbers.map((entry) => entry.phoneNumber)).toEqual(['+14125551212', '+14125558989'])
  })

  it('parses successful send XML', () => {
    const result = parseApidazeSendResponse('<ok><uuid>abc-123</uuid></ok>', 200)
    expect(result.success).toBe(true)
    expect(result.messageId).toBe('abc-123')
  })

  it('parses failed send XML', () => {
    const result = parseApidazeSendResponse('<error>from number not on application</error>', 200)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/from number/i)
  })

  it('reads inbound GET-style fields', () => {
    expect(
      parseApidazeInboundParams({
        caller_id_number: '14125551212',
        destination_number: '14125558989',
        body: 'Yes please',
        uuid: 'msg-1',
      })
    ).toEqual({
      from: '14125551212',
      to: '14125558989',
      body: 'Yes please',
      uuid: 'msg-1',
    })
  })
})

describe('apidaze webhook secret', () => {
  it('allows traffic when no secret is configured', () => {
    const previous = process.env.APIDAZE_WEBHOOK_SECRET
    delete process.env.APIDAZE_WEBHOOK_SECRET
    expect(isApidazeWebhookAuthorized(null)).toBe(true)
    process.env.APIDAZE_WEBHOOK_SECRET = previous
  })

  it('rejects a missing or wrong secret when configured', () => {
    const previous = process.env.APIDAZE_WEBHOOK_SECRET
    process.env.APIDAZE_WEBHOOK_SECRET = 'expected'
    expect(isApidazeWebhookAuthorized(null)).toBe(false)
    expect(isApidazeWebhookAuthorized('wrong')).toBe(false)
    expect(isApidazeWebhookAuthorized('expected')).toBe(true)
    process.env.APIDAZE_WEBHOOK_SECRET = previous
  })
})

describe('sms provider selection', () => {
  it('prefers Apidaze when the platform and practice from-number are set', () => {
    expect(
      selectSmsProvider({
        apidazePlatformConfigured: true,
        apidazeActive: true,
        apidazeFromNumber: '+15551234567',
        twilioPreferForSmsOutbound: true,
        twilioFromNumber: '+15550001111',
        twilioAccountSid: 'sid',
        twilioAuthToken: 'token',
        telnyxApiKey: 'KEY',
        telnyxFromNumber: '+15552223333',
      })
    ).toBe('apidaze')
  })

  it('falls back to Telnyx when Apidaze is not assigned', () => {
    expect(
      selectSmsProvider({
        apidazePlatformConfigured: true,
        apidazeActive: false,
        twilioPreferForSmsOutbound: false,
        telnyxApiKey: 'KEY',
        telnyxFromNumber: '+15552223333',
      })
    ).toBe('telnyx')
  })
})
