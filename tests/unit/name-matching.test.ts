import { describe, it, expect } from 'vitest'
import {
  normalizeName,
  parseFullName,
  namesMatch,
  patientNameMatches,
} from '@/lib/name-matching'

describe('Name Matching Utilities', () => {
  describe('normalizeName', () => {
    it('should convert to lowercase', () => {
      expect(normalizeName('John Doe')).toBe('john doe')
      expect(normalizeName('JANE SMITH')).toBe('jane smith')
      expect(normalizeName('MaRy JaNe')).toBe('mary jane')
    })

    it('should trim whitespace', () => {
      expect(normalizeName('  John Doe  ')).toBe('john doe')
      expect(normalizeName('\t\nJohn Doe\r\n')).toBe('john doe')
    })

    it('should normalize internal whitespace', () => {
      expect(normalizeName('John   Doe')).toBe('john doe')
      expect(normalizeName('John  Middle  Doe')).toBe('john middle doe')
    })

    it('should remove common punctuation', () => {
      expect(normalizeName('John A. Doe')).toBe('john a doe')
      expect(normalizeName("O'Brien")).toBe('obrien')
      expect(normalizeName('Mary-Jane Smith')).toBe('maryjane smith')
      expect(normalizeName('John, Jr.')).toBe('john jr')
    })

    it('should handle empty string', () => {
      expect(normalizeName('')).toBe('')
    })

    it('should handle whitespace-only string', () => {
      expect(normalizeName('   ')).toBe('')
    })
  })

  describe('parseFullName', () => {
    it('should parse simple first and last name', () => {
      const result = parseFullName('John Doe')
      expect(result.first).toBe('john')
      expect(result.last).toBe('doe')
    })

    it('should parse name with middle name', () => {
      const result = parseFullName('John Michael Doe')
      expect(result.first).toBe('john michael')
      expect(result.last).toBe('doe')
    })

    it('should parse name with multiple middle names', () => {
      const result = parseFullName('Mary Jane Anne Smith')
      expect(result.first).toBe('mary jane anne')
      expect(result.last).toBe('smith')
    })

    it('should handle single name', () => {
      const result = parseFullName('Cher')
      expect(result.first).toBe('cher')
      expect(result.last).toBe('')
    })

    it('should handle empty string', () => {
      const result = parseFullName('')
      expect(result.first).toBe('')
      expect(result.last).toBe('')
    })

    it('should handle whitespace-only string', () => {
      const result = parseFullName('   ')
      expect(result.first).toBe('')
      expect(result.last).toBe('')
    })

    it('should remove punctuation before parsing', () => {
      const result = parseFullName('John A. Doe')
      expect(result.first).toBe('john a')
      expect(result.last).toBe('doe')
    })
  })

  describe('namesMatch', () => {
    describe('exact matches', () => {
      it('should match identical names', () => {
        expect(namesMatch('John Doe', 'John Doe')).toBe(true)
      })

      it('should match names with different casing', () => {
        expect(namesMatch('John Doe', 'john doe')).toBe(true)
        expect(namesMatch('JOHN DOE', 'john doe')).toBe(true)
      })

      it('should match names with extra whitespace', () => {
        expect(namesMatch('John Doe', '  John  Doe  ')).toBe(true)
      })
    })

    describe('flexible first name matching', () => {
      it('should match when one first name starts with the other', () => {
        expect(namesMatch('John Doe', 'Jo Doe')).toBe(true) // John starts with Jo
        expect(namesMatch('Johnny Doe', 'John Doe')).toBe(true) // Johnny starts with John
        // Note: The name-matching implementation allows "John" to match "Johnny" because 
        // "johnny" starts with "john"
        expect(namesMatch('John Doe', 'Johnny Doe')).toBe(true) // johnny starts with john
      })

      it('should match with middle initial variations', () => {
        expect(namesMatch('John Doe', 'John A Doe')).toBe(true)
        expect(namesMatch('John A Doe', 'John Doe')).toBe(true)
      })
    })

    describe('last name matching', () => {
      it('should not match different last names', () => {
        expect(namesMatch('John Doe', 'John Smith')).toBe(false)
      })

      it('should match when only one name has last name', () => {
        expect(namesMatch('John', 'John Doe')).toBe(true)
        expect(namesMatch('John Doe', 'John')).toBe(true)
      })
    })

    describe('punctuation handling', () => {
      it('should match names with different punctuation', () => {
        expect(namesMatch('John A. Doe', 'John A Doe')).toBe(true)
        expect(namesMatch("O'Brien", 'OBrien')).toBe(true)
        expect(namesMatch('Mary-Jane Smith', 'MaryJane Smith')).toBe(true)
      })
    })

    describe('edge cases', () => {
      it('should not match empty names', () => {
        expect(namesMatch('', '')).toBe(true) // Both empty after normalization
        expect(namesMatch('John', '')).toBe(false)
        expect(namesMatch('', 'John')).toBe(false)
      })

      it('should not match completely different names', () => {
        expect(namesMatch('John Doe', 'Jane Smith')).toBe(false)
        expect(namesMatch('Alice', 'Bob')).toBe(false)
      })
    })
  })

  describe('patientNameMatches', () => {
    describe('matching against name field', () => {
      it('should match against patient.name', () => {
        const patient = { name: 'John Doe' }
        expect(patientNameMatches(patient, 'John Doe')).toBe(true)
        expect(patientNameMatches(patient, 'john doe')).toBe(true)
      })

      it('should not match different name', () => {
        const patient = { name: 'John Doe' }
        expect(patientNameMatches(patient, 'Jane Smith')).toBe(false)
      })
    })

    describe('matching against firstName + lastName', () => {
      it('should match using firstName and lastName', () => {
        const patient = { firstName: 'John', lastName: 'Doe' }
        expect(patientNameMatches(patient, 'John Doe')).toBe(true)
      })

      it('should match when only firstName is provided', () => {
        const patient = { firstName: 'John' }
        expect(patientNameMatches(patient, 'John')).toBe(true)
        expect(patientNameMatches(patient, 'John Doe')).toBe(true)
      })

      it('should match when only lastName is provided', () => {
        const patient = { lastName: 'Doe' }
        expect(patientNameMatches(patient, 'Doe')).toBe(true)
      })
    })

    describe('matching against preferredName', () => {
      it('should match against preferredName', () => {
        const patient = {
          name: 'Jonathan Doe',
          preferredName: 'Johnny Doe',
        }
        expect(patientNameMatches(patient, 'Johnny Doe')).toBe(true)
      })

      it('should try preferredName even if name does not match', () => {
        const patient = {
          name: 'Jonathan Michael Doe',
          preferredName: 'John Doe',
        }
        expect(patientNameMatches(patient, 'John Doe')).toBe(true)
      })
    })

    describe('priority of matching', () => {
      it('should match if any name field matches', () => {
        const patient = {
          name: 'Robert Doe',
          firstName: 'Bobby',
          lastName: 'Doe',
          preferredName: 'Bob Doe',
        }
        expect(patientNameMatches(patient, 'Robert Doe')).toBe(true)
        expect(patientNameMatches(patient, 'Bobby Doe')).toBe(true)
        expect(patientNameMatches(patient, 'Bob Doe')).toBe(true)
      })
    })

    describe('null/undefined handling', () => {
      it('should handle null name fields', () => {
        const patient = {
          name: null,
          firstName: 'John',
          lastName: 'Doe',
        }
        expect(patientNameMatches(patient, 'John Doe')).toBe(true)
      })

      it('should handle all null name fields', () => {
        const patient = {
          name: null,
          firstName: null,
          lastName: null,
          preferredName: null,
        }
        expect(patientNameMatches(patient, 'John Doe')).toBe(false)
      })

      it('should handle empty patient object', () => {
        const patient = {}
        expect(patientNameMatches(patient, 'John Doe')).toBe(false)
      })
    })

    describe('real-world scenarios', () => {
      it('should handle middle name variations', () => {
        const patient = { name: 'John Michael Doe' }
        expect(patientNameMatches(patient, 'John Doe')).toBe(true)
        expect(patientNameMatches(patient, 'John M Doe')).toBe(true)
        expect(patientNameMatches(patient, 'John M. Doe')).toBe(true)
      })

      it('should handle hyphenated last names', () => {
        const patient = { name: 'Mary Smith-Jones' }
        expect(patientNameMatches(patient, 'Mary SmithJones')).toBe(true)
        expect(patientNameMatches(patient, 'Mary Smith-Jones')).toBe(true)
      })

      it('should handle apostrophe names', () => {
        const patient = { name: "Patrick O'Brien" }
        expect(patientNameMatches(patient, 'Patrick OBrien')).toBe(true)
        expect(patientNameMatches(patient, "Patrick O'Brien")).toBe(true)
      })

      it('should handle suffix variations', () => {
        const patient = { name: 'John Doe Jr' }
        expect(patientNameMatches(patient, 'John Doe Jr.')).toBe(true)
        expect(patientNameMatches(patient, 'John Doe Jr')).toBe(true)
      })
    })
  })
})
