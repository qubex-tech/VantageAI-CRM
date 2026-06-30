import { describe, it, expect } from 'vitest'
import {
  computeInsuranceCompleteness,
  deriveBcbsAlphaPrefix,
  maskMemberId,
} from '@/lib/insurance-completeness'

describe('Insurance Completeness Utilities', () => {
  describe('computeInsuranceCompleteness', () => {
    const completePatient = {
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-15'),
      addressLine1: '123 Main St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
    }

    it('should return ready status for complete policy with patient as subscriber', () => {
      const policy = {
        payerNameRaw: 'Aetna',
        memberId: 'ABC123456',
        subscriberIsPatient: true,
      }

      const result = computeInsuranceCompleteness(policy, completePatient)
      
      expect(result.status).toBe('ready')
      expect(result.missingFields).toHaveLength(0)
    })

    it('should identify missing payer name', () => {
      const policy = {
        payerNameRaw: '',
        memberId: 'ABC123456',
        subscriberIsPatient: true,
      }

      const result = computeInsuranceCompleteness(policy, completePatient)
      
      expect(result.status).toBe('missing_info')
      expect(result.missingFields).toContain('Payer name')
    })

    it('should identify missing member ID', () => {
      const policy = {
        payerNameRaw: 'Aetna',
        memberId: '',
        subscriberIsPatient: true,
      }

      const result = computeInsuranceCompleteness(policy, completePatient)
      
      expect(result.status).toBe('missing_info')
      expect(result.missingFields).toContain('Member ID')
    })

    it('should identify missing patient first name when both names are null', () => {
      const policy = {
        payerNameRaw: 'Aetna',
        memberId: 'ABC123',
        subscriberIsPatient: true,
      }
      // Both firstName and lastName null, no legacy name to derive from
      const patient = { ...completePatient, firstName: null, lastName: null, name: null }

      const result = computeInsuranceCompleteness(policy, patient)
      
      expect(result.missingFields).toContain('Patient first name')
    })

    it('should identify missing patient last name when both names are null', () => {
      const policy = {
        payerNameRaw: 'Aetna',
        memberId: 'ABC123',
        subscriberIsPatient: true,
      }
      // Both firstName and lastName null, no legacy name to derive from
      const patient = { ...completePatient, firstName: null, lastName: null, name: null }

      const result = computeInsuranceCompleteness(policy, patient)
      
      expect(result.missingFields).toContain('Patient last name')
    })

    it('should identify missing patient date of birth', () => {
      const policy = {
        payerNameRaw: 'Aetna',
        memberId: 'ABC123',
        subscriberIsPatient: true,
      }
      const patient = { ...completePatient, dateOfBirth: null }

      const result = computeInsuranceCompleteness(policy, patient)
      
      expect(result.missingFields).toContain('Patient date of birth')
    })

    it('should derive name from legacy name field', () => {
      const policy = {
        payerNameRaw: 'Aetna',
        memberId: 'ABC123',
        subscriberIsPatient: true,
      }
      const patient = {
        name: 'John Doe',
        firstName: null,
        lastName: null,
        dateOfBirth: new Date('1990-01-15'),
      }

      const result = computeInsuranceCompleteness(policy, patient)
      
      expect(result.missingFields).not.toContain('Patient first name')
      expect(result.missingFields).not.toContain('Patient last name')
    })

    describe('subscriber not patient', () => {
      it('should require subscriber details when subscriber is not patient', () => {
        const policy = {
          payerNameRaw: 'Aetna',
          memberId: 'ABC123',
          subscriberIsPatient: false,
        }

        const result = computeInsuranceCompleteness(policy, completePatient)
        
        expect(result.status).toBe('missing_info')
        expect(result.missingFields).toContain('Subscriber first name')
        expect(result.missingFields).toContain('Subscriber last name')
        expect(result.missingFields).toContain('Subscriber date of birth')
        expect(result.missingFields).toContain('Relationship to patient')
      })

      it('should be ready when subscriber info is complete', () => {
        const policy = {
          payerNameRaw: 'Aetna',
          memberId: 'ABC123',
          subscriberIsPatient: false,
          subscriberFirstName: 'Jane',
          subscriberLastName: 'Doe',
          subscriberDob: new Date('1985-05-20'),
          relationshipToPatient: 'Spouse',
        }

        const result = computeInsuranceCompleteness(policy, completePatient)
        
        expect(result.status).toBe('ready')
        expect(result.missingFields).toHaveLength(0)
      })
    })

    describe('BCBS policies', () => {
      it('should require alpha prefix for BCBS payer', () => {
        const policy = {
          payerNameRaw: 'Blue Cross Blue Shield of Texas',
          memberId: '123456789',
          subscriberIsPatient: true,
        }

        const result = computeInsuranceCompleteness(policy, completePatient)
        
        expect(result.missingFields).toContain('BCBS alpha prefix (could not derive from Member ID)')
      })

      it('should auto-derive alpha prefix from member ID', () => {
        const policy = {
          payerNameRaw: 'BCBS of Illinois',
          memberId: 'XYZ123456789', // First 3 chars are letters
          subscriberIsPatient: true,
        }

        const result = computeInsuranceCompleteness(policy, completePatient)
        
        expect(result.missingFields).not.toContain('BCBS alpha prefix (could not derive from Member ID)')
      })

      it('should accept explicit bcbsAlphaPrefix', () => {
        const policy = {
          payerNameRaw: 'BCBS',
          memberId: '123456789',
          subscriberIsPatient: true,
          bcbsAlphaPrefix: 'XYZ',
        }

        const result = computeInsuranceCompleteness(policy, completePatient)
        
        expect(result.missingFields).not.toContain('BCBS alpha prefix (could not derive from Member ID)')
      })

      it('should detect BCBS from various name variations', () => {
        const policyBase = {
          memberId: '123456789',
          subscriberIsPatient: true,
        }

        const bcbsNames = [
          'BCBS of Texas',
          'Blue Cross Blue Shield',
          'BCBS Illinois',
          'Blue Cross of California',
        ]

        bcbsNames.forEach(payerName => {
          const result = computeInsuranceCompleteness(
            { ...policyBase, payerNameRaw: payerName },
            completePatient
          )
          expect(result.missingFields.some(f => f.includes('BCBS'))).toBe(true)
        })
      })
    })

    describe('warnings', () => {
      it('should warn about missing ZIP code', () => {
        const policy = {
          payerNameRaw: 'Aetna',
          memberId: 'ABC123',
          subscriberIsPatient: true,
        }
        const patient = { ...completePatient, postalCode: '' }

        const result = computeInsuranceCompleteness(policy, patient)
        
        expect(result.warnings).toContain('Patient ZIP')
      })

      it('should warn about invalid ZIP format', () => {
        const policy = {
          payerNameRaw: 'Aetna',
          memberId: 'ABC123',
          subscriberIsPatient: true,
        }
        const patient = { ...completePatient, postalCode: '123' }

        const result = computeInsuranceCompleteness(policy, patient)
        
        expect(result.warnings.some(w => w.includes('ZIP'))).toBe(true)
      })

      it('should accept valid 5-digit ZIP', () => {
        const policy = {
          payerNameRaw: 'Aetna',
          memberId: 'ABC123',
          subscriberIsPatient: true,
        }
        const patient = { ...completePatient, postalCode: '78701' }

        const result = computeInsuranceCompleteness(policy, patient)
        
        expect(result.warnings).not.toContain('Patient ZIP')
        expect(result.warnings.filter(w => w.includes('ZIP'))).toHaveLength(0)
      })

      it('should accept valid ZIP+4 format', () => {
        const policy = {
          payerNameRaw: 'Aetna',
          memberId: 'ABC123',
          subscriberIsPatient: true,
        }
        const patient = { ...completePatient, postalCode: '78701-1234' }

        const result = computeInsuranceCompleteness(policy, patient)
        
        expect(result.warnings.filter(w => w.includes('ZIP'))).toHaveLength(0)
      })

      it('should warn about missing address', () => {
        const policy = {
          payerNameRaw: 'Aetna',
          memberId: 'ABC123',
          subscriberIsPatient: true,
        }
        const patient = { ...completePatient, addressLine1: '' }

        const result = computeInsuranceCompleteness(policy, patient)
        
        expect(result.warnings).toContain('Address line 1')
      })

      it('should warn about missing city and state', () => {
        const policy = {
          payerNameRaw: 'Aetna',
          memberId: 'ABC123',
          subscriberIsPatient: true,
        }
        const patient = { ...completePatient, city: '', state: '' }

        const result = computeInsuranceCompleteness(policy, patient)
        
        expect(result.warnings).toContain('City')
        expect(result.warnings).toContain('State')
      })
    })
  })

  describe('deriveBcbsAlphaPrefix', () => {
    it('should derive prefix from 3-letter start', () => {
      expect(deriveBcbsAlphaPrefix('XYZ123456')).toBe('XYZ')
      expect(deriveBcbsAlphaPrefix('ABC987654321')).toBe('ABC')
    })

    it('should return null for numeric start', () => {
      expect(deriveBcbsAlphaPrefix('123456789')).toBeNull()
      expect(deriveBcbsAlphaPrefix('1AB456789')).toBeNull()
    })

    it('should return null for short member ID', () => {
      expect(deriveBcbsAlphaPrefix('AB')).toBeNull()
      expect(deriveBcbsAlphaPrefix('')).toBeNull()
    })

    it('should return null for null/undefined input', () => {
      expect(deriveBcbsAlphaPrefix(null as any)).toBeNull()
      expect(deriveBcbsAlphaPrefix(undefined as any)).toBeNull()
    })

    it('should handle mixed case', () => {
      expect(deriveBcbsAlphaPrefix('xyz123')).toBe('xyz')
      expect(deriveBcbsAlphaPrefix('XyZ123')).toBe('XyZ')
    })
  })

  describe('maskMemberId', () => {
    it('should mask member ID showing last 4 digits', () => {
      expect(maskMemberId('ABC123456789')).toBe('****6789')
      expect(maskMemberId('12345678')).toBe('****5678')
    })

    it('should return **** for short member IDs', () => {
      expect(maskMemberId('1234')).toBe('****')
      expect(maskMemberId('123')).toBe('****')
      expect(maskMemberId('1')).toBe('****')
    })

    it('should return dash for null or empty', () => {
      expect(maskMemberId(null)).toBe('—')
      expect(maskMemberId(undefined)).toBe('—')
      expect(maskMemberId('')).toBe('—')
    })

    it('should handle exactly 4 characters', () => {
      expect(maskMemberId('ABCD')).toBe('****')
    })

    it('should handle exactly 5 characters', () => {
      expect(maskMemberId('ABCDE')).toBe('****BCDE')
    })
  })
})
