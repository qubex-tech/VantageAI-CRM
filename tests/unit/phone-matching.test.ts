import { describe, it, expect } from 'vitest'

// Re-implement the pure utility functions for testing without DB dependency
// These match the implementations in src/lib/patient-phone-match.ts

function normalizePhoneDigits(value?: string | null): string {
  if (!value) return ''
  return String(value).replace(/[^\d]/g, '')
}

function getPhoneLast10(value?: string | null): string {
  const digits = normalizePhoneDigits(value)
  return digits.length >= 10 ? digits.slice(-10) : digits
}

function phoneNumbersMatchLoosely(
  a?: string | null,
  b?: string | null
): boolean {
  const digitsA = normalizePhoneDigits(a)
  const digitsB = normalizePhoneDigits(b)
  if (!digitsA || !digitsB) return false
  if (digitsA === digitsB) return true
  const last10A = digitsA.slice(-10)
  const last10B = digitsB.slice(-10)
  return last10A.length === 10 && last10B.length === 10 && last10A === last10B
}

type PatientPhoneMatch = {
  id: string
  practiceId: string
  phone: string | null
  primaryPhone: string | null
  secondaryPhone: string | null
}

function pickPatientMatchForInbound(
  matches: PatientPhoneMatch[],
  preferPracticeIds?: string[]
): PatientPhoneMatch | null {
  if (matches.length === 0) return null
  if (!preferPracticeIds?.length) return matches[0]

  for (const practiceId of preferPracticeIds) {
    const preferred = matches.find((patient) => patient.practiceId === practiceId)
    if (preferred) return preferred
  }

  return matches[0]
}

describe('Phone Matching Utilities', () => {
  describe('normalizePhoneDigits', () => {
    it('should extract only digits from phone number', () => {
      expect(normalizePhoneDigits('(555) 123-4567')).toBe('5551234567')
      expect(normalizePhoneDigits('+1-555-123-4567')).toBe('15551234567')
      expect(normalizePhoneDigits('555.123.4567')).toBe('5551234567')
    })

    it('should handle already clean phone numbers', () => {
      expect(normalizePhoneDigits('5551234567')).toBe('5551234567')
      expect(normalizePhoneDigits('15551234567')).toBe('15551234567')
    })

    it('should return empty string for null or undefined', () => {
      expect(normalizePhoneDigits(null)).toBe('')
      expect(normalizePhoneDigits(undefined)).toBe('')
    })

    it('should return empty string for empty input', () => {
      expect(normalizePhoneDigits('')).toBe('')
    })

    it('should handle letters and special characters', () => {
      expect(normalizePhoneDigits('phone: 5551234567 ext 101')).toBe('5551234567101')
    })
  })

  describe('getPhoneLast10', () => {
    it('should return last 10 digits for long numbers', () => {
      expect(getPhoneLast10('+1-555-123-4567')).toBe('5551234567')
      expect(getPhoneLast10('15551234567')).toBe('5551234567')
    })

    it('should return exact digits for 10-digit numbers', () => {
      expect(getPhoneLast10('5551234567')).toBe('5551234567')
    })

    it('should return full digits for numbers shorter than 10', () => {
      expect(getPhoneLast10('12345')).toBe('12345')
      expect(getPhoneLast10('123456789')).toBe('123456789')
    })

    it('should handle formatted phone numbers', () => {
      expect(getPhoneLast10('(555) 123-4567')).toBe('5551234567')
    })

    it('should return empty string for null or undefined', () => {
      expect(getPhoneLast10(null)).toBe('')
      expect(getPhoneLast10(undefined)).toBe('')
    })
  })

  describe('phoneNumbersMatchLoosely', () => {
    it('should match identical phone numbers', () => {
      expect(phoneNumbersMatchLoosely('5551234567', '5551234567')).toBe(true)
    })

    it('should match numbers with different formatting', () => {
      expect(phoneNumbersMatchLoosely('(555) 123-4567', '555-123-4567')).toBe(true)
      expect(phoneNumbersMatchLoosely('+1-555-123-4567', '5551234567')).toBe(true)
    })

    it('should match when one has country code', () => {
      expect(phoneNumbersMatchLoosely('15551234567', '5551234567')).toBe(true)
      expect(phoneNumbersMatchLoosely('+15551234567', '5551234567')).toBe(true)
    })

    it('should not match different numbers', () => {
      expect(phoneNumbersMatchLoosely('5551234567', '5559876543')).toBe(false)
    })

    it('should not match when one is too short', () => {
      expect(phoneNumbersMatchLoosely('12345', '5551234567')).toBe(false)
    })

    it('should return false for null or empty inputs', () => {
      expect(phoneNumbersMatchLoosely(null, '5551234567')).toBe(false)
      expect(phoneNumbersMatchLoosely('5551234567', null)).toBe(false)
      expect(phoneNumbersMatchLoosely('', '5551234567')).toBe(false)
      expect(phoneNumbersMatchLoosely(null, null)).toBe(false)
    })
  })

  describe('pickPatientMatchForInbound', () => {
    const createPatient = (id: string, practiceId: string): PatientPhoneMatch => ({
      id,
      practiceId,
      phone: '+15551234567',
      primaryPhone: null,
      secondaryPhone: null,
    })

    it('should return null for empty matches array', () => {
      expect(pickPatientMatchForInbound([])).toBeNull()
    })

    it('should return first match when no preferences specified', () => {
      const matches = [
        createPatient('p1', 'practice-a'),
        createPatient('p2', 'practice-b'),
      ]
      const result = pickPatientMatchForInbound(matches)
      expect(result?.id).toBe('p1')
    })

    it('should return first match when preferences array is empty', () => {
      const matches = [
        createPatient('p1', 'practice-a'),
        createPatient('p2', 'practice-b'),
      ]
      const result = pickPatientMatchForInbound(matches, [])
      expect(result?.id).toBe('p1')
    })

    it('should prefer patient from preferred practice', () => {
      const matches = [
        createPatient('p1', 'practice-a'),
        createPatient('p2', 'practice-b'),
        createPatient('p3', 'practice-c'),
      ]
      const result = pickPatientMatchForInbound(matches, ['practice-b'])
      expect(result?.id).toBe('p2')
    })

    it('should respect preference order', () => {
      const matches = [
        createPatient('p1', 'practice-a'),
        createPatient('p2', 'practice-b'),
        createPatient('p3', 'practice-c'),
      ]
      const result = pickPatientMatchForInbound(matches, ['practice-c', 'practice-b'])
      expect(result?.id).toBe('p3')
    })

    it('should fall back to first match when no preference matches', () => {
      const matches = [
        createPatient('p1', 'practice-a'),
        createPatient('p2', 'practice-b'),
      ]
      const result = pickPatientMatchForInbound(matches, ['practice-x', 'practice-y'])
      expect(result?.id).toBe('p1')
    })

    it('should handle single match', () => {
      const matches = [createPatient('p1', 'practice-a')]
      const result = pickPatientMatchForInbound(matches, ['practice-a'])
      expect(result?.id).toBe('p1')
    })
  })
})
