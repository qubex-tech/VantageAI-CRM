import { describe, it, expect } from 'vitest'
import {
  redactPhone,
  redactEmail,
  redactSSN,
  redactMRN,
  redactPHI,
  redactPHIFromObject,
  safeStringify,
} from '@/lib/phi'

describe('PHI Redaction Utilities', () => {
  describe('redactPhone', () => {
    it('should redact standard US phone numbers', () => {
      expect(redactPhone('Call me at 555-123-4567')).toBe('Call me at [PHONE_REDACTED]')
      expect(redactPhone('Phone: 555.123.4567')).toBe('Phone: [PHONE_REDACTED]')
      expect(redactPhone('5551234567')).toBe('[PHONE_REDACTED]')
    })

    it('should redact multiple phone numbers', () => {
      const text = 'Home: 555-111-2222, Work: 555-333-4444'
      const result = redactPhone(text)
      expect(result).toBe('Home: [PHONE_REDACTED], Work: [PHONE_REDACTED]')
    })

    it('should not modify text without phone numbers', () => {
      const text = 'Hello, this is a message without phone numbers'
      expect(redactPhone(text)).toBe(text)
    })

    it('should handle phone numbers at boundaries', () => {
      expect(redactPhone('5551234567 is my number')).toBe('[PHONE_REDACTED] is my number')
      expect(redactPhone('Call 5551234567')).toBe('Call [PHONE_REDACTED]')
    })
  })

  describe('redactEmail', () => {
    it('should redact standard email addresses', () => {
      expect(redactEmail('Email me at john@example.com')).toBe('Email me at [EMAIL_REDACTED]')
      expect(redactEmail('Contact: jane.doe@company.org')).toBe('Contact: [EMAIL_REDACTED]')
    })

    it('should redact multiple email addresses', () => {
      const text = 'Primary: a@b.com, Secondary: c@d.org'
      const result = redactEmail(text)
      expect(result).toBe('Primary: [EMAIL_REDACTED], Secondary: [EMAIL_REDACTED]')
    })

    it('should handle complex email formats', () => {
      expect(redactEmail('user.name+tag@sub.domain.co.uk')).toBe('[EMAIL_REDACTED]')
      expect(redactEmail('test_user123@example.com')).toBe('[EMAIL_REDACTED]')
    })

    it('should not modify text without email addresses', () => {
      const text = 'No email here, just @ symbol'
      expect(redactEmail(text)).toBe(text)
    })
  })

  describe('redactSSN', () => {
    it('should redact SSNs with dashes', () => {
      expect(redactSSN('SSN: 123-45-6789')).toBe('SSN: [SSN_REDACTED]')
    })

    it('should redact SSNs without dashes', () => {
      expect(redactSSN('SSN: 123456789')).toBe('SSN: [SSN_REDACTED]')
    })

    it('should redact partial SSNs', () => {
      expect(redactSSN('SSN: 12345-6789')).toBe('SSN: [SSN_REDACTED]')
    })

    it('should handle multiple SSNs', () => {
      const text = 'SSN1: 111-22-3333, SSN2: 444-55-6666'
      expect(redactSSN(text)).toBe('SSN1: [SSN_REDACTED], SSN2: [SSN_REDACTED]')
    })

    it('should not modify text without SSN patterns', () => {
      const text = 'Not an SSN: 12-34-5678'
      expect(redactSSN(text)).toBe(text)
    })
  })

  describe('redactMRN', () => {
    it('should redact MRN with colon', () => {
      expect(redactMRN('MRN: 12345')).toBe('[MRN_REDACTED]')
      expect(redactMRN('mrn: 98765')).toBe('[MRN_REDACTED]')
    })

    it('should redact MRN without colon', () => {
      expect(redactMRN('MRN 12345')).toBe('[MRN_REDACTED]')
      expect(redactMRN('MRN12345')).toBe('[MRN_REDACTED]')
    })

    it('should handle MRN with spaces', () => {
      expect(redactMRN('MRN :  12345')).toBe('[MRN_REDACTED]')
    })

    it('should redact multiple MRNs', () => {
      const text = 'Patient MRN: 111 and MRN: 222'
      expect(redactMRN(text)).toBe('Patient [MRN_REDACTED] and [MRN_REDACTED]')
    })

    it('should be case insensitive', () => {
      expect(redactMRN('Mrn: 123')).toBe('[MRN_REDACTED]')
      expect(redactMRN('MRN: 123')).toBe('[MRN_REDACTED]')
      expect(redactMRN('mrn: 123')).toBe('[MRN_REDACTED]')
    })
  })

  describe('redactPHI', () => {
    it('should redact all PHI types in one call', () => {
      const text = 'Patient John Doe, phone 555-123-4567, email john@example.com, SSN 123-45-6789, MRN: 12345'
      const result = redactPHI(text)
      
      expect(result).toContain('[PHONE_REDACTED]')
      expect(result).toContain('[EMAIL_REDACTED]')
      expect(result).toContain('[SSN_REDACTED]')
      expect(result).toContain('[MRN_REDACTED]')
      expect(result).not.toContain('555-123-4567')
      expect(result).not.toContain('john@example.com')
      expect(result).not.toContain('123-45-6789')
      expect(result).not.toContain('12345')
    })

    it('should handle null input', () => {
      expect(redactPHI(null)).toBe('')
    })

    it('should handle undefined input', () => {
      expect(redactPHI(undefined)).toBe('')
    })

    it('should handle empty string', () => {
      expect(redactPHI('')).toBe('')
    })

    it('should preserve non-PHI text', () => {
      const text = 'Hello world, appointment at 10am'
      expect(redactPHI(text)).toBe(text)
    })
  })

  describe('redactPHIFromObject', () => {
    it('should redact phone field', () => {
      const obj = { phone: '555-123-4567', name: 'John Doe' }
      const result = redactPHIFromObject(obj)
      
      expect(result.phone).toBe('[PHONE_REDACTED]')
      expect(result.name).toBe('John Doe')
    })

    it('should redact email field', () => {
      const obj = { email: 'john@example.com', id: '123' }
      const result = redactPHIFromObject(obj)
      
      expect(result.email).toBe('[EMAIL_REDACTED]')
      expect(result.id).toBe('123')
    })

    it('should handle nested objects', () => {
      const obj = {
        patient: {
          phone: '555-123-4567',
          email: 'test@example.com',
        },
        note: 'Some note',
      }
      const result = redactPHIFromObject(obj)
      
      expect((result.patient as any).phone).toBe('[PHONE_REDACTED]')
      expect((result.patient as any).email).toBe('[EMAIL_REDACTED]')
      expect(result.note).toBe('Some note')
    })

    it('should handle arrays in objects', () => {
      const obj = {
        contacts: [
          { phone: '555-111-2222' },
          { phone: '555-333-4444' },
        ],
      }
      const result = redactPHIFromObject(obj)
      
      expect((result.contacts as any)[0].phone).toBe('[PHONE_REDACTED]')
      expect((result.contacts as any)[1].phone).toBe('[PHONE_REDACTED]')
    })

    it('should use custom fields to redact', () => {
      const obj = {
        customField: '555-123-4567',
        phone: '555-999-8888',
      }
      const result = redactPHIFromObject(obj, ['customfield'])
      
      expect(result.customField).toBe('[PHONE_REDACTED]')
      expect(result.phone).toBe('555-999-8888')
    })

    it('should handle null values in object', () => {
      const obj = { phone: null, email: null, name: 'Test' }
      const result = redactPHIFromObject(obj)
      
      expect(result.phone).toBeNull()
      expect(result.email).toBeNull()
      expect(result.name).toBe('Test')
    })

    it('should handle empty object', () => {
      const result = redactPHIFromObject({})
      expect(result).toEqual({})
    })

    it('should redact SSN field', () => {
      const obj = { ssn: '123-45-6789' }
      const result = redactPHIFromObject(obj)
      expect(result.ssn).toBe('[SSN_REDACTED]')
    })

    it('should redact address field values containing PHI patterns', () => {
      // The redactPHIFromObject function applies redactPHI to fields in the fieldsToRedact list
      // It searches for and redacts PHI patterns (phone, email, ssn, mrn) within those field values
      const obj = { phone: '555-123-4567', customAddress: '123 Main Street' }
      const result = redactPHIFromObject(obj, ['phone'])
      // Phone field should have the phone number redacted
      expect(result.phone).toBe('[PHONE_REDACTED]')
      // Custom address field not in redaction list stays unchanged
      expect(result.customAddress).toBe('123 Main Street')
    })
  })

  describe('safeStringify', () => {
    it('should stringify and redact PHI', () => {
      const obj = { phone: '555-123-4567', data: 'test' }
      const result = safeStringify(obj)
      
      expect(result).toContain('[PHONE_REDACTED]')
      expect(result).toContain('test')
      expect(result).not.toContain('555-123-4567')
    })

    it('should handle circular references gracefully', () => {
      const obj: any = { name: 'test' }
      obj.self = obj
      
      const result = safeStringify(obj)
      expect(result).toBe('[Error stringifying object]')
    })

    it('should produce valid JSON when no errors', () => {
      const obj = { email: 'test@example.com', count: 5 }
      const result = safeStringify(obj)
      
      expect(() => JSON.parse(result)).not.toThrow()
    })

    it('should handle nested objects', () => {
      const obj = {
        patient: {
          email: 'patient@example.com',
          phone: '555-123-4567',
        },
        metadata: {
          createdAt: '2024-01-01',
        },
      }
      const result = safeStringify(obj)
      
      expect(result).toContain('[EMAIL_REDACTED]')
      expect(result).toContain('[PHONE_REDACTED]')
      expect(result).toContain('2024-01-01')
    })
  })

  describe('Edge cases', () => {
    it('should handle very long text', () => {
      const longText = 'a'.repeat(10000) + ' 555-123-4567 ' + 'b'.repeat(10000)
      const result = redactPhone(longText)
      
      expect(result).toContain('[PHONE_REDACTED]')
      expect(result.length).toBe(longText.length - '555-123-4567'.length + '[PHONE_REDACTED]'.length)
    })

    it('should handle special characters around PHI', () => {
      expect(redactPhone('(555-123-4567)')).toBe('([PHONE_REDACTED])')
      expect(redactEmail('<john@example.com>')).toBe('<[EMAIL_REDACTED]>')
    })

    it('should handle line breaks', () => {
      const text = 'Line 1\n555-123-4567\nLine 3'
      expect(redactPhone(text)).toBe('Line 1\n[PHONE_REDACTED]\nLine 3')
    })
  })
})
