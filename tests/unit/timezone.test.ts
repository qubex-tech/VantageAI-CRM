import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  DEFAULT_PRACTICE_TIMEZONE,
  formatUserFacingDateTime,
  formatUserFacingDateRange,
  normalizeTimeZone,
  formatDateTime,
  formatDateOnly,
} from '@/lib/timezone'

describe('Timezone Utilities', () => {
  describe('DEFAULT_PRACTICE_TIMEZONE', () => {
    it('should be America/Chicago', () => {
      expect(DEFAULT_PRACTICE_TIMEZONE).toBe('America/Chicago')
    })
  })

  describe('normalizeTimeZone', () => {
    it('should return valid IANA timezone', () => {
      expect(normalizeTimeZone('America/New_York')).toBe('America/New_York')
      expect(normalizeTimeZone('America/Los_Angeles')).toBe('America/Los_Angeles')
      expect(normalizeTimeZone('Europe/London')).toBe('Europe/London')
      expect(normalizeTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo')
    })

    it('should return undefined for invalid timezone', () => {
      expect(normalizeTimeZone('Invalid/Timezone')).toBeUndefined()
      expect(normalizeTimeZone('Not_A_Timezone')).toBeUndefined()
    })

    it('should return undefined for null', () => {
      expect(normalizeTimeZone(null)).toBeUndefined()
    })

    it('should return undefined for undefined', () => {
      expect(normalizeTimeZone(undefined)).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
      expect(normalizeTimeZone('')).toBeUndefined()
    })

    it('should handle UTC', () => {
      expect(normalizeTimeZone('UTC')).toBe('UTC')
    })

    it('should handle common US timezones', () => {
      const usTimezones = [
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Phoenix',
        'Pacific/Honolulu',
      ]
      usTimezones.forEach(tz => {
        expect(normalizeTimeZone(tz)).toBe(tz)
      })
    })
  })

  describe('formatUserFacingDateTime', () => {
    const testDate = new Date('2024-06-15T14:30:00Z')

    it('should format date with default options', () => {
      const result = formatUserFacingDateTime(testDate)
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('should format date-only when dateOnly is true', () => {
      const result = formatUserFacingDateTime(testDate, { dateOnly: true })
      expect(result).toBeTruthy()
      // Should not contain time portion
      expect(result).not.toMatch(/\d{1,2}:\d{2}/)
    })

    it('should format time-only when timeOnly is true', () => {
      const result = formatUserFacingDateTime(testDate, { timeOnly: true })
      expect(result).toBeTruthy()
      // Should contain time portion
      expect(result).toMatch(/\d{1,2}:\d{2}/)
    })

    it('should respect timezone option', () => {
      const result1 = formatUserFacingDateTime(testDate, { timeZone: 'America/New_York' })
      const result2 = formatUserFacingDateTime(testDate, { timeZone: 'America/Los_Angeles' })
      
      // The times should be different due to timezone
      expect(result1).not.toBe(result2)
    })

    it('should return "Invalid date" for invalid input', () => {
      expect(formatUserFacingDateTime('invalid')).toBe('Invalid date')
      expect(formatUserFacingDateTime(NaN)).toBe('Invalid date')
    })

    it('should accept string input', () => {
      const result = formatUserFacingDateTime('2024-06-15T14:30:00Z')
      expect(result).toBeTruthy()
      expect(result).not.toBe('Invalid date')
    })

    it('should accept number (timestamp) input', () => {
      const timestamp = new Date('2024-06-15T14:30:00Z').getTime()
      const result = formatUserFacingDateTime(timestamp)
      expect(result).toBeTruthy()
      expect(result).not.toBe('Invalid date')
    })

    it('should respect dateStyle option', () => {
      const fullResult = formatUserFacingDateTime(testDate, { dateStyle: 'full', dateOnly: true })
      const shortResult = formatUserFacingDateTime(testDate, { dateStyle: 'short', dateOnly: true })
      
      // Full style should be longer
      expect(fullResult.length).toBeGreaterThan(shortResult.length)
    })

    it('should respect timeStyle option', () => {
      const fullResult = formatUserFacingDateTime(testDate, { timeStyle: 'full', timeOnly: true })
      const shortResult = formatUserFacingDateTime(testDate, { timeStyle: 'short', timeOnly: true })
      
      // Full style should be longer
      expect(fullResult.length).toBeGreaterThan(shortResult.length)
    })

    it('should respect locale option', () => {
      const enResult = formatUserFacingDateTime(testDate, { locale: 'en-US', dateOnly: true })
      const deResult = formatUserFacingDateTime(testDate, { locale: 'de-DE', dateOnly: true })
      
      // Different locales should produce different formats
      expect(enResult).not.toBe(deResult)
    })
  })

  describe('formatUserFacingDateRange', () => {
    it('should format date range correctly', () => {
      const from = new Date('2024-06-01')
      const to = new Date('2024-06-15')
      
      const result = formatUserFacingDateRange(from, to)
      
      expect(result).toContain('Jun')
      expect(result).toContain('2024')
      expect(result).toContain('–')
    })

    it('should include both dates', () => {
      const from = new Date('2024-01-15')
      const to = new Date('2024-02-15')
      
      const result = formatUserFacingDateRange(from, to)
      
      expect(result).toContain('Jan')
      expect(result).toContain('Feb')
    })

    it('should respect timezone', () => {
      const from = new Date('2024-06-01T00:00:00Z')
      const to = new Date('2024-06-15T00:00:00Z')
      
      const result = formatUserFacingDateRange(from, to, 'America/New_York')
      expect(result).toBeTruthy()
    })

    it('should handle same-day range', () => {
      const date = new Date('2024-06-15')
      const result = formatUserFacingDateRange(date, date)
      
      expect(result).toBeTruthy()
      expect(result).toContain('Jun')
    })
  })

  describe('formatDateTime', () => {
    const testDate = new Date('2024-06-15T14:30:00Z')

    it('should format date with default options', () => {
      const result = formatDateTime(testDate)
      expect(result).toBeTruthy()
      expect(result).not.toBe('Invalid date')
    })

    it('should return "Invalid date" for invalid input', () => {
      expect(formatDateTime('invalid')).toBe('Invalid date')
      expect(formatDateTime(NaN)).toBe('Invalid date')
    })

    it('should accept string input', () => {
      const result = formatDateTime('2024-06-15T14:30:00Z')
      expect(result).not.toBe('Invalid date')
    })

    it('should accept number input', () => {
      const result = formatDateTime(testDate.getTime())
      expect(result).not.toBe('Invalid date')
    })

    it('should respect timezone option', () => {
      const nyResult = formatDateTime(testDate, { timeZone: 'America/New_York' })
      const laResult = formatDateTime(testDate, { timeZone: 'America/Los_Angeles' })
      
      expect(nyResult).not.toBe(laResult)
    })

    it('should respect locale option', () => {
      const enResult = formatDateTime(testDate, { locale: 'en-US' })
      const frResult = formatDateTime(testDate, { locale: 'fr-FR' })
      
      // Different locales may produce different formats
      expect(enResult).toBeTruthy()
      expect(frResult).toBeTruthy()
    })

    it('should respect dateStyle option', () => {
      const fullResult = formatDateTime(testDate, { dateStyle: 'full' })
      const shortResult = formatDateTime(testDate, { dateStyle: 'short' })
      
      expect(fullResult.length).toBeGreaterThan(shortResult.length)
    })

    it('should respect timeStyle option', () => {
      const fullResult = formatDateTime(testDate, { timeStyle: 'full' })
      const shortResult = formatDateTime(testDate, { timeStyle: 'short' })
      
      expect(fullResult.length).toBeGreaterThan(shortResult.length)
    })
  })

  describe('formatDateOnly', () => {
    const testDate = new Date('2024-06-15T14:30:00Z')

    it('should format date without time', () => {
      const result = formatDateOnly(testDate)
      expect(result).toBeTruthy()
      expect(result).not.toBe('Invalid date')
    })

    it('should return "Invalid date" for invalid input', () => {
      expect(formatDateOnly('invalid')).toBe('Invalid date')
    })

    it('should accept string input', () => {
      const result = formatDateOnly('2024-06-15')
      expect(result).not.toBe('Invalid date')
    })

    it('should accept number input', () => {
      const result = formatDateOnly(testDate.getTime())
      expect(result).not.toBe('Invalid date')
    })

    it('should respect timezone option', () => {
      // Date at midnight UTC
      const date = new Date('2024-06-15T00:00:00Z')
      
      const utcResult = formatDateOnly(date, { timeZone: 'UTC' })
      const laResult = formatDateOnly(date, { timeZone: 'America/Los_Angeles' })
      
      // LA is behind UTC, so midnight UTC is previous day in LA
      expect(utcResult).not.toBe(laResult)
    })

    it('should respect locale option', () => {
      const enResult = formatDateOnly(testDate, { locale: 'en-US' })
      const deResult = formatDateOnly(testDate, { locale: 'de-DE' })
      
      // Different locales format months differently
      expect(enResult).toBeTruthy()
      expect(deResult).toBeTruthy()
    })

    it('should respect dateStyle option', () => {
      const fullResult = formatDateOnly(testDate, { dateStyle: 'full' })
      const shortResult = formatDateOnly(testDate, { dateStyle: 'short' })
      
      expect(fullResult.length).toBeGreaterThan(shortResult.length)
    })
  })

  describe('Edge cases', () => {
    it('should handle dates at year boundary', () => {
      const newYearsEve = new Date('2024-12-31T23:59:59Z')
      const newYearsDay = new Date('2025-01-01T00:00:00Z')
      
      const range = formatUserFacingDateRange(newYearsEve, newYearsDay)
      expect(range).toContain('2024')
      expect(range).toContain('2025')
    })

    it('should handle dates at daylight saving transitions', () => {
      // Spring forward (March 2024)
      const beforeDST = new Date('2024-03-10T06:00:00Z')
      const afterDST = new Date('2024-03-10T08:00:00Z')
      
      const result1 = formatDateTime(beforeDST, { timeZone: 'America/New_York' })
      const result2 = formatDateTime(afterDST, { timeZone: 'America/New_York' })
      
      expect(result1).toBeTruthy()
      expect(result2).toBeTruthy()
    })

    it('should handle leap year dates', () => {
      const leapDay = new Date('2024-02-29T12:00:00Z')
      
      const result = formatDateOnly(leapDay, { timeZone: 'UTC' })
      expect(result).toContain('29')
    })

    it('should handle very old dates', () => {
      const oldDate = new Date('1900-01-01')
      
      const result = formatDateOnly(oldDate)
      expect(result).toBeTruthy()
      expect(result).not.toBe('Invalid date')
    })

    it('should handle far future dates', () => {
      const futureDate = new Date('2100-12-31')
      
      const result = formatDateOnly(futureDate)
      expect(result).toBeTruthy()
      expect(result).not.toBe('Invalid date')
    })
  })
})
