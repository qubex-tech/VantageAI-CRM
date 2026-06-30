import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  normalizeDateOnly,
  parseDateOnlyString,
  formatDateOnly,
  formatDateOnlyForInput,
  calculateAgeFromDateOnly,
} from '@/lib/date'

describe('Date Utilities', () => {
  describe('normalizeDateOnly', () => {
    it('should normalize Date object to UTC midnight', () => {
      const date = new Date('2024-06-15T14:30:00Z')
      const result = normalizeDateOnly(date)
      
      expect(result).not.toBeNull()
      expect(result!.getUTCHours()).toBe(0)
      expect(result!.getUTCMinutes()).toBe(0)
      expect(result!.getUTCSeconds()).toBe(0)
      expect(result!.getUTCDate()).toBe(15)
      expect(result!.getUTCMonth()).toBe(5) // June (0-indexed)
      expect(result!.getUTCFullYear()).toBe(2024)
    })

    it('should parse date string and normalize to UTC midnight', () => {
      const result = normalizeDateOnly('2024-06-15T14:30:00Z')
      
      expect(result).not.toBeNull()
      expect(result!.getUTCHours()).toBe(0)
      expect(result!.getUTCDate()).toBe(15)
    })

    it('should return null for null input', () => {
      expect(normalizeDateOnly(null)).toBeNull()
    })

    it('should return null for undefined input', () => {
      expect(normalizeDateOnly(undefined)).toBeNull()
    })

    it('should return null for invalid date string', () => {
      expect(normalizeDateOnly('not-a-date')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(normalizeDateOnly('')).toBeNull()
    })

    it('should handle ISO date strings', () => {
      const result = normalizeDateOnly('2024-01-01')
      expect(result).not.toBeNull()
      expect(result!.getUTCFullYear()).toBe(2024)
      expect(result!.getUTCMonth()).toBe(0)
      expect(result!.getUTCDate()).toBe(1)
    })

    it('should handle dates at year boundaries', () => {
      const result = normalizeDateOnly('2024-12-31T23:59:59Z')
      expect(result).not.toBeNull()
      expect(result!.getUTCFullYear()).toBe(2024)
      expect(result!.getUTCMonth()).toBe(11)
      expect(result!.getUTCDate()).toBe(31)
    })
  })

  describe('parseDateOnlyString', () => {
    it('should parse valid YYYY-MM-DD format', () => {
      const result = parseDateOnlyString('2024-06-15')
      
      expect(result).not.toBeNull()
      expect(result!.getUTCFullYear()).toBe(2024)
      expect(result!.getUTCMonth()).toBe(5)
      expect(result!.getUTCDate()).toBe(15)
    })

    it('should return null for invalid format', () => {
      expect(parseDateOnlyString('06/15/2024')).toBeNull()
      expect(parseDateOnlyString('2024/06/15')).toBeNull()
      expect(parseDateOnlyString('15-06-2024')).toBeNull()
    })

    it('should return null for null input', () => {
      expect(parseDateOnlyString(null)).toBeNull()
    })

    it('should return null for undefined input', () => {
      expect(parseDateOnlyString(undefined)).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(parseDateOnlyString('')).toBeNull()
    })

    it('should trim whitespace', () => {
      const result = parseDateOnlyString('  2024-06-15  ')
      expect(result).not.toBeNull()
      expect(result!.getUTCDate()).toBe(15)
    })

    it('should return null for invalid month', () => {
      expect(parseDateOnlyString('2024-13-15')).toBeNull()
      expect(parseDateOnlyString('2024-00-15')).toBeNull()
    })

    it('should return null for invalid day', () => {
      expect(parseDateOnlyString('2024-06-32')).toBeNull()
      expect(parseDateOnlyString('2024-06-00')).toBeNull()
    })

    it('should handle leap years', () => {
      const leapYear = parseDateOnlyString('2024-02-29')
      expect(leapYear).not.toBeNull()
      expect(leapYear!.getUTCDate()).toBe(29)
    })

    it('should handle boundary dates', () => {
      const janFirst = parseDateOnlyString('2024-01-01')
      expect(janFirst).not.toBeNull()
      expect(janFirst!.getUTCMonth()).toBe(0)
      expect(janFirst!.getUTCDate()).toBe(1)

      const decLast = parseDateOnlyString('2024-12-31')
      expect(decLast).not.toBeNull()
      expect(decLast!.getUTCMonth()).toBe(11)
      expect(decLast!.getUTCDate()).toBe(31)
    })
  })

  describe('formatDateOnly', () => {
    it('should format date as yyyy-MM-dd', () => {
      const date = new Date(Date.UTC(2024, 5, 15))
      const result = formatDateOnly(date, 'yyyy-MM-dd')
      expect(result).toBe('2024-06-15')
    })

    it('should format date as MMM d, yyyy', () => {
      const date = new Date(Date.UTC(2024, 5, 15))
      const result = formatDateOnly(date, 'MMM d, yyyy')
      expect(result).toMatch(/Jun\s+15,\s+2024/)
    })

    it('should format date as MMMM d, yyyy', () => {
      const date = new Date(Date.UTC(2024, 5, 15))
      const result = formatDateOnly(date, 'MMMM d, yyyy')
      expect(result).toMatch(/June\s+15,\s+2024/)
    })

    it('should return empty string for null input', () => {
      expect(formatDateOnly(null, 'yyyy-MM-dd')).toBe('')
    })

    it('should return empty string for undefined input', () => {
      expect(formatDateOnly(undefined, 'yyyy-MM-dd')).toBe('')
    })

    it('should return empty string for invalid date', () => {
      expect(formatDateOnly('invalid', 'yyyy-MM-dd')).toBe('')
    })

    it('should handle date string input', () => {
      const result = formatDateOnly('2024-06-15', 'yyyy-MM-dd')
      expect(result).toBe('2024-06-15')
    })

    it('should default to yyyy-MM-dd for unknown pattern', () => {
      const date = new Date(Date.UTC(2024, 5, 15))
      const result = formatDateOnly(date, 'unknown-pattern')
      expect(result).toBe('2024-06-15')
    })

    it('should handle single digit days and months', () => {
      const date = new Date(Date.UTC(2024, 0, 5))
      const result = formatDateOnly(date, 'yyyy-MM-dd')
      expect(result).toBe('2024-01-05')
    })
  })

  describe('formatDateOnlyForInput', () => {
    it('should format date for HTML input field', () => {
      const date = new Date(Date.UTC(2024, 5, 15))
      const result = formatDateOnlyForInput(date)
      expect(result).toBe('2024-06-15')
    })

    it('should return empty string for null', () => {
      expect(formatDateOnlyForInput(null)).toBe('')
    })

    it('should handle string input', () => {
      const result = formatDateOnlyForInput('2024-06-15T12:00:00Z')
      expect(result).toBe('2024-06-15')
    })
  })

  describe('calculateAgeFromDateOnly', () => {
    beforeEach(() => {
      // Mock current date to 2024-06-15
      vi.useFakeTimers()
      vi.setSystemTime(new Date(Date.UTC(2024, 5, 15)))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should calculate correct age when birthday has passed this year', () => {
      const birthDate = new Date(Date.UTC(1990, 0, 15)) // Jan 15, 1990
      const age = calculateAgeFromDateOnly(birthDate)
      expect(age).toBe(34)
    })

    it('should calculate correct age when birthday has not passed this year', () => {
      const birthDate = new Date(Date.UTC(1990, 11, 25)) // Dec 25, 1990
      const age = calculateAgeFromDateOnly(birthDate)
      expect(age).toBe(33)
    })

    it('should calculate correct age on birthday', () => {
      const birthDate = new Date(Date.UTC(1990, 5, 15)) // Jun 15, 1990
      const age = calculateAgeFromDateOnly(birthDate)
      expect(age).toBe(34)
    })

    it('should return 0 for null input', () => {
      expect(calculateAgeFromDateOnly(null)).toBe(0)
    })

    it('should return 0 for undefined input', () => {
      expect(calculateAgeFromDateOnly(undefined)).toBe(0)
    })

    it('should return 0 for invalid date string', () => {
      expect(calculateAgeFromDateOnly('not-a-date')).toBe(0)
    })

    it('should handle date string input', () => {
      const age = calculateAgeFromDateOnly('1990-01-15')
      expect(age).toBe(34)
    })

    it('should handle age 0 for recent birth', () => {
      const birthDate = new Date(Date.UTC(2024, 5, 1)) // Jun 1, 2024
      const age = calculateAgeFromDateOnly(birthDate)
      expect(age).toBe(0)
    })

    it('should handle leap year birthdays', () => {
      const birthDate = new Date(Date.UTC(2000, 1, 29)) // Feb 29, 2000
      const age = calculateAgeFromDateOnly(birthDate)
      expect(age).toBe(24)
    })

    it('should handle very old dates', () => {
      const birthDate = new Date(Date.UTC(1920, 0, 1))
      const age = calculateAgeFromDateOnly(birthDate)
      expect(age).toBe(104)
    })
  })

  describe('Edge cases', () => {
    it('should handle dates at midnight UTC', () => {
      const date = new Date(Date.UTC(2024, 5, 15, 0, 0, 0))
      const normalized = normalizeDateOnly(date)
      expect(normalized!.toISOString()).toBe('2024-06-15T00:00:00.000Z')
    })

    it('should handle dates just before midnight UTC', () => {
      const date = new Date(Date.UTC(2024, 5, 15, 23, 59, 59))
      const normalized = normalizeDateOnly(date)
      expect(normalized!.toISOString()).toBe('2024-06-15T00:00:00.000Z')
    })

    it('should consistently normalize the same date', () => {
      const date1 = normalizeDateOnly('2024-06-15T00:00:00Z')
      const date2 = normalizeDateOnly('2024-06-15T12:30:00Z')
      const date3 = normalizeDateOnly('2024-06-15T23:59:59Z')
      
      expect(date1!.getTime()).toBe(date2!.getTime())
      expect(date2!.getTime()).toBe(date3!.getTime())
    })
  })
})
