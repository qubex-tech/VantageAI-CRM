import { describe, it, expect } from 'vitest'
import {
  readRetellTransferNotificationFields,
  isUnsuccessfulTransferFromRetellAnalysis,
  isUnsuccessfulTransferOutcomeText,
  buildStaffCallLogDeepLink,
  formatCallTimestampForPracticeEmail,
} from '@/lib/outbound-customer-notifications'
import { isSafeInternalCallbackPath } from '@/lib/safe-callback-path'
import type { RetellCall } from '@/lib/retell-api'

function callWithCustomAnalysis(data: Record<string, unknown>): RetellCall {
  return {
    call_id: 'call_test_1',
    call_type: 'phone_call',
    agent_id: 'agent_1',
    call_status: 'ended',
    call_analysis: {
      custom_analysis_data: data,
    },
  } as RetellCall
}

describe('readRetellTransferNotificationFields', () => {
  it('reads human-readable Retell keys via normalization', () => {
    const call = callWithCustomAnalysis({
      'Transfer Outcome': 'not successful',
      'Voicemail Message': 'Please call me back tomorrow.',
    })
    expect(readRetellTransferNotificationFields(call)).toEqual({
      transferOutcome: 'not successful',
      voicemailMessage: 'Please call me back tomorrow.',
    })
  })

  it('reads snake_case keys', () => {
    const call = callWithCustomAnalysis({
      transfer_outcome: 'Not Successful',
      voicemail_message: 'Left a message',
    })
    expect(readRetellTransferNotificationFields(call)).toEqual({
      transferOutcome: 'Not Successful',
      voicemailMessage: 'Left a message',
    })
  })

  it('returns nulls when custom_analysis_data is missing', () => {
    const call = {
      call_id: 'x',
      call_type: 'phone_call',
      agent_id: 'a',
      call_status: 'ended',
    } as RetellCall
    expect(readRetellTransferNotificationFields(call)).toEqual({
      transferOutcome: null,
      voicemailMessage: null,
    })
  })
})

describe('formatCallTimestampForPracticeEmail', () => {
  it('formats the same instant in the practice IANA zone (not UTC labels)', () => {
    // 2026-04-24 14:47:00 UTC
    const ms = Date.UTC(2026, 3, 24, 14, 47, 0)
    const chicago = formatCallTimestampForPracticeEmail(ms, 'America/Chicago')
    const utc = formatCallTimestampForPracticeEmail(ms, 'UTC')
    expect(utc).toMatch(/2:47/)
    expect(utc.toUpperCase()).toContain('UTC')
    expect(chicago).toMatch(/9:47/)
    expect(chicago.toUpperCase()).not.toContain('UTC')
  })
})

describe('buildStaffCallLogDeepLink', () => {
  it('includes call path and practiceId for tenant context', () => {
    const url = buildStaffCallLogDeepLink('call_retell_1', 'practice-uuid-1')
    expect(url).toContain('/calls/call_retell_1')
    expect(url).toContain('practiceId=practice-uuid-1')
  })

  it('encodes special characters in call id', () => {
    const url = buildStaffCallLogDeepLink('a/b', 'p')
    expect(url).toContain(encodeURIComponent('a/b'))
  })
})

describe('isSafeInternalCallbackPath', () => {
  it('allows paths with query strings', () => {
    expect(isSafeInternalCallbackPath('/calls/x?practiceId=y')).toBe(true)
  })

  it('rejects protocol-relative and absolute URLs', () => {
    expect(isSafeInternalCallbackPath('//evil.com')).toBe(false)
    expect(isSafeInternalCallbackPath('/ok?u=https://evil.com')).toBe(true)
    expect(isSafeInternalCallbackPath('https://evil.com')).toBe(false)
  })
})

describe('isUnsuccessfulTransferOutcomeText', () => {
  const shortPhrase =
    'Transfer call cannot be completed, the other side did not pick up.'
  const longPhrase =
    'Transfer call cannot be completed, the other side did not pick up.. please inform the customer that the transfer did not go through and offer to try again or assist them directly.'

  it('is true for did-not-pick-up transfer failure copy (short and long)', () => {
    expect(isUnsuccessfulTransferOutcomeText(shortPhrase)).toBe(true)
    expect(isUnsuccessfulTransferOutcomeText(longPhrase)).toBe(true)
    expect(isUnsuccessfulTransferOutcomeText(`  ${shortPhrase}  `)).toBe(true)
  })
})

describe('isUnsuccessfulTransferFromRetellAnalysis', () => {
  it('is true when outcome is not successful (case-insensitive)', () => {
    expect(
      isUnsuccessfulTransferFromRetellAnalysis(
        callWithCustomAnalysis({ 'Transfer Outcome': 'NOT SUCCESSFUL' })
      )
    ).toBe(true)
    expect(
      isUnsuccessfulTransferFromRetellAnalysis(
        callWithCustomAnalysis({ transfer_outcome: 'not successful' })
      )
    ).toBe(true)
    expect(
      isUnsuccessfulTransferFromRetellAnalysis(
        callWithCustomAnalysis({ 'Transfer Outcome': '  not successful  ' })
      )
    ).toBe(true)
  })

  it('is true when outcome is did-not-pick-up copy from Retell analysis', () => {
    const shortOutcome =
      'transfer call cannot be completed, the other side did not pick up.'
    expect(
      isUnsuccessfulTransferFromRetellAnalysis(
        callWithCustomAnalysis({ 'Transfer Outcome': shortOutcome })
      )
    ).toBe(true)
    expect(
      isUnsuccessfulTransferFromRetellAnalysis(
        callWithCustomAnalysis({
          transfer_outcome:
            'Transfer call cannot be completed, the other side did not pick up.. please inform the customer that the transfer did not go through and offer to try again or assist them directly.',
        })
      )
    ).toBe(true)
  })

  it('is false for other outcomes or missing field', () => {
    expect(
      isUnsuccessfulTransferFromRetellAnalysis(
        callWithCustomAnalysis({ 'Transfer Outcome': 'successful' })
      )
    ).toBe(false)
    expect(isUnsuccessfulTransferFromRetellAnalysis(callWithCustomAnalysis({}))).toBe(false)
  })
})
