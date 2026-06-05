import { describe, expect, it } from 'vitest'
import {
  getPhoneLast10,
  normalizePhoneDigits,
  phoneNumbersMatchLoosely,
  pickPatientMatchForInbound,
} from '@/lib/patient-phone-match'

describe('patient phone match helpers', () => {
  it('strips unicode direction marks and formatting', () => {
    const formatted = '‪(708) 885-9801‬'
    expect(normalizePhoneDigits(formatted)).toBe('7088859801')
    expect(getPhoneLast10(formatted)).toBe('7088859801')
  })

  it('matches E.164 and local formats by last 10 digits', () => {
    expect(phoneNumbersMatchLoosely('+17088859801', '7088859801')).toBe(true)
    expect(phoneNumbersMatchLoosely('(708) 885-9801', '+17088859801')).toBe(true)
    expect(phoneNumbersMatchLoosely('+13125551234', '+17088859801')).toBe(false)
  })

  it('prefers patient on Telnyx-configured practice when phone is duplicated', () => {
    const matches = [
      {
        id: 'lonestar',
        practiceId: '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75',
        phone: '17088859801',
        primaryPhone: null,
        secondaryPhone: null,
      },
      {
        id: 'john-doe',
        practiceId: '9def9875-2d98-4f67-8745-d954ec02a9bb',
        phone: '‪(708) 885-9801‬',
        primaryPhone: '‪(708) 885-9801‬',
        secondaryPhone: null,
      },
    ]
    const picked = pickPatientMatchForInbound(matches, [
      '3f72e4f4-693f-45c7-a5c6-27c538f742ee',
      '9def9875-2d98-4f67-8745-d954ec02a9bb',
    ])
    expect(picked?.id).toBe('john-doe')
  })
})
