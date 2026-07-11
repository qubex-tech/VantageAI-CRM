import { describe, it, expect } from 'vitest'
import { parseListCsv, splitPatientName } from '@/lib/lists/import-csv'

describe('list CSV helpers', () => {
  describe('splitPatientName', () => {
    it('splits first and last name', () => {
      expect(splitPatientName('Jane Doe')).toEqual({
        firstName: 'Jane',
        lastName: 'Doe',
        name: 'Jane Doe',
      })
    })

    it('keeps multi-part first names', () => {
      expect(splitPatientName('Mary Ann Smith')).toEqual({
        firstName: 'Mary Ann',
        lastName: 'Smith',
        name: 'Mary Ann Smith',
      })
    })

    it('handles single token names', () => {
      expect(splitPatientName('Madonna')).toEqual({
        firstName: 'Madonna',
        lastName: '',
        name: 'Madonna',
      })
    })
  })

  describe('parseListCsv', () => {
    it('parses the standard template headers', () => {
      const csv = [
        'Patient Name,Email Address,Phone Number',
        'Jane Doe,jane@example.com,+15551234567',
        'John Smith,john@example.com,5559876543',
      ].join('\n')

      const parsed = parseListCsv(csv)
      expect(parsed.errors).toEqual([])
      expect(parsed.rows).toEqual([
        { name: 'Jane Doe', email: 'jane@example.com', phone: '+15551234567' },
        { name: 'John Smith', email: 'john@example.com', phone: '5559876543' },
      ])
    })

    it('accepts alias headers', () => {
      const csv = ['Name,Email,Phone', 'Ada Lovelace,ada@example.com,5551112222'].join('\n')
      const parsed = parseListCsv(csv)
      expect(parsed.errors).toEqual([])
      expect(parsed.rows).toHaveLength(1)
      expect(parsed.rows[0].name).toBe('Ada Lovelace')
    })

    it('requires patient name column', () => {
      const csv = ['Email Address,Phone Number', 'a@b.com,555'].join('\n')
      const parsed = parseListCsv(csv)
      expect(parsed.errors.some((e) => e.includes('Patient Name'))).toBe(true)
    })

    it('skips blank data rows', () => {
      const csv = ['Patient Name,Email Address,Phone Number', ',,', 'Jane,,555'].join('\n')
      const parsed = parseListCsv(csv)
      expect(parsed.rows).toEqual([{ name: 'Jane', email: '', phone: '555' }])
    })
  })
})
