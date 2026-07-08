import { describe, expect, it } from 'vitest'
import {
  getPhoneLast10,
  normalizePhoneDigits,
  patientMatchesReplyPhone,
  phoneNumbersMatchLoosely,
  pickPatientMatchForInbound,
  pickScopedPhoneMatch,
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
        name: 'Test Patient',
        firstName: 'Test',
        lastName: 'Patient',
        dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
        phone: '17088859801',
        primaryPhone: null,
        secondaryPhone: null,
      },
      {
        id: 'john-doe',
        practiceId: '9def9875-2d98-4f67-8745-d954ec02a9bb',
        name: 'Test Patient',
        firstName: 'Test',
        lastName: 'Patient',
        dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
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

  it('matches reply phone against patient record numbers', () => {
    const patient = {
      phone: '‪(708) 885-9801‬',
      primaryPhone: '‪(708) 885-9801‬',
      secondaryPhone: null,
    }
    expect(patientMatchesReplyPhone(patient, '+17088859801')).toBe(true)
    expect(patientMatchesReplyPhone(patient, '+13125551234')).toBe(false)
  })

  it('disambiguates duplicate phone by DOB instead of picking arbitrarily', () => {
    const steve1992 = {
      id: 'e91fd677-acc7-4423-b5a8-238ebdc3a538',
      practiceId: '9def9875-2d98-4f67-8745-d954ec02a9bb',
      name: 'Steve Madden',
      firstName: 'Steve',
      lastName: 'Madden',
      dateOfBirth: new Date('1992-01-23T00:00:00.000Z'),
      phone: '17088859801',
      primaryPhone: '17088859801',
      secondaryPhone: null,
    }
    const steve1996 = {
      id: '3e343cd3-98e9-4737-9519-085263246b81',
      practiceId: '9def9875-2d98-4f67-8745-d954ec02a9bb',
      name: 'Steve Madden',
      firstName: 'Steve',
      lastName: 'Madden',
      dateOfBirth: new Date('1996-01-06T00:00:00.000Z'),
      phone: '17088859801',
      primaryPhone: '17088859801',
      secondaryPhone: null,
    }
    const matches = [steve1992, steve1996]

    expect(pickScopedPhoneMatch(matches, { dateOfBirth: '1992-01-23' })?.id).toBe(steve1992.id)
    expect(pickScopedPhoneMatch(matches, { dateOfBirth: '1996-01-06' })?.id).toBe(steve1996.id)
    expect(pickScopedPhoneMatch(matches, {})).toBeNull()
    expect(
      pickScopedPhoneMatch(matches, { preferredPatientId: steve1996.id })?.id
    ).toBe(steve1996.id)
  })
})
