import { describe, it, expect } from 'vitest'
import { isSafeInternalCallbackPath } from '@/lib/safe-callback-path'

describe('Safe Callback Path Utility', () => {
  describe('valid internal paths', () => {
    it('should accept dashboard path', () => {
      expect(isSafeInternalCallbackPath('/dashboard')).toBe(true)
    })

    it('should accept patients paths', () => {
      expect(isSafeInternalCallbackPath('/patients')).toBe(true)
      expect(isSafeInternalCallbackPath('/patients/123')).toBe(true)
      expect(isSafeInternalCallbackPath('/patients/new')).toBe(true)
    })

    it('should accept appointments paths', () => {
      expect(isSafeInternalCallbackPath('/appointments')).toBe(true)
      expect(isSafeInternalCallbackPath('/appointments/123')).toBe(true)
    })

    it('should accept settings paths', () => {
      expect(isSafeInternalCallbackPath('/settings')).toBe(true)
      expect(isSafeInternalCallbackPath('/settings/integrations')).toBe(true)
    })

    it('should accept paths with query strings', () => {
      expect(isSafeInternalCallbackPath('/dashboard?tab=overview')).toBe(true)
      expect(isSafeInternalCallbackPath('/patients?search=john')).toBe(true)
    })
  })

  describe('blocked external URLs', () => {
    it('should reject full URLs', () => {
      expect(isSafeInternalCallbackPath('https://evil.com/steal')).toBe(false)
      expect(isSafeInternalCallbackPath('http://evil.com')).toBe(false)
    })

    it('should reject protocol-relative URLs', () => {
      expect(isSafeInternalCallbackPath('//evil.com/path')).toBe(false)
    })

    it('should reject javascript: URLs', () => {
      expect(isSafeInternalCallbackPath('javascript:alert(1)')).toBe(false)
    })

    it('should reject data: URLs', () => {
      expect(isSafeInternalCallbackPath('data:text/html,<script>')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(isSafeInternalCallbackPath('')).toBe(false)
    })

    it('should handle root path', () => {
      expect(isSafeInternalCallbackPath('/')).toBe(true)
    })

    it('should reject paths not starting with /', () => {
      expect(isSafeInternalCallbackPath('dashboard')).toBe(false)
      expect(isSafeInternalCallbackPath('patients/123')).toBe(false)
    })
  })
})
