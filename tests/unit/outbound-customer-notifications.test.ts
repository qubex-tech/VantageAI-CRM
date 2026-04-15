import { describe, it, expect } from 'vitest'
import {
  readRetellTransferNotificationFields,
  isUnsuccessfulTransferFromRetellAnalysis,
} from '@/lib/outbound-customer-notifications'
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

  it('is false for other outcomes or missing field', () => {
    expect(
      isUnsuccessfulTransferFromRetellAnalysis(
        callWithCustomAnalysis({ 'Transfer Outcome': 'successful' })
      )
    ).toBe(false)
    expect(isUnsuccessfulTransferFromRetellAnalysis(callWithCustomAnalysis({}))).toBe(false)
  })
})
