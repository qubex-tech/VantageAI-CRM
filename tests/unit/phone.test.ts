import { describe, it, expect } from 'vitest'
import { normalizePhoneForDialing } from '@/lib/phone'

describe('Phone Utilities', () => {
  describe('normalizePhoneForDialing', () => {
    describe('Basic US phone numbers', () => {
      it('should normalize 10-digit US number to E.164 format', () => {
        expect(normalizePhoneForDialing('5551234567')).toBe('+15551234567')
        expect(normalizePhoneForDialing('(555) 123-4567')).toBe('+15551234567')
        expect(normalizePhoneForDialing('555-123-4567')).toBe('+15551234567')
        expect(normalizePhoneForDialing('555.123.4567')).toBe('+15551234567')
        expect(normalizePhoneForDialing('555 123 4567')).toBe('+15551234567')
      })

      it('should handle 11-digit US number starting with 1', () => {
        expect(normalizePhoneForDialing('15551234567')).toBe('+15551234567')
        expect(normalizePhoneForDialing('1-555-123-4567')).toBe('+15551234567')
        expect(normalizePhoneForDialing('1 (555) 123-4567')).toBe('+15551234567')
      })

      it('should preserve existing + prefix', () => {
        expect(normalizePhoneForDialing('+15551234567')).toBe('+15551234567')
        expect(normalizePhoneForDialing('+1 555 123 4567')).toBe('+15551234567')
        expect(normalizePhoneForDialing('+1-555-123-4567')).toBe('+15551234567')
      })
    })

    describe('International numbers', () => {
      it('should preserve international format with +', () => {
        expect(normalizePhoneForDialing('+447911123456')).toBe('+447911123456') // UK
        expect(normalizePhoneForDialing('+33123456789')).toBe('+33123456789')   // France
        expect(normalizePhoneForDialing('+81312345678')).toBe('+81312345678')   // Japan
      })

      it('should add + prefix to raw international digits', () => {
        expect(normalizePhoneForDialing('447911123456')).toBe('+447911123456')
      })
    })

    describe('Edge cases', () => {
      it('should return null for null input', () => {
        expect(normalizePhoneForDialing(null)).toBeNull()
      })

      it('should return null for undefined input', () => {
        expect(normalizePhoneForDialing(undefined)).toBeNull()
      })

      it('should return null for empty string', () => {
        expect(normalizePhoneForDialing('')).toBeNull()
      })

      it('should return null for whitespace only', () => {
        expect(normalizePhoneForDialing('   ')).toBeNull()
      })

      it('should return null for non-numeric string', () => {
        expect(normalizePhoneForDialing('not-a-number')).toBeNull()
        expect(normalizePhoneForDialing('abc')).toBeNull()
      })

      it('should trim whitespace from input', () => {
        expect(normalizePhoneForDialing('  5551234567  ')).toBe('+15551234567')
        expect(normalizePhoneForDialing('\t+15551234567\n')).toBe('+15551234567')
      })
    })

    describe('Special formatting', () => {
      it('should strip all non-digit characters', () => {
        // When extension/extra digits are present, resulting number is longer than 10 digits
        // so it just gets a + prefix without the 1 country code
        expect(normalizePhoneForDialing('(555) 123-4567 ext. 123')).toBe('+5551234567123')
        expect(normalizePhoneForDialing('555.123.4567#101')).toBe('+5551234567101')
      })

      it('should handle mixed formatting', () => {
        expect(normalizePhoneForDialing('+1 (555) 123-4567')).toBe('+15551234567')
        expect(normalizePhoneForDialing('+1.555.123.4567')).toBe('+15551234567')
      })
    })

    describe('Short numbers', () => {
      it('should add + prefix to short numbers', () => {
        expect(normalizePhoneForDialing('12345')).toBe('+12345')
        expect(normalizePhoneForDialing('123456789')).toBe('+123456789')
      })
    })

    describe('Long numbers', () => {
      it('should handle numbers longer than 11 digits', () => {
        expect(normalizePhoneForDialing('155512345678901')).toBe('+155512345678901')
      })
    })
  })
})
