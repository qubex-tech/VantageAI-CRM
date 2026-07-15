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

    it('normalizes comma-delimited names from CSV exports', () => {
      expect(splitPatientName('Corona,Genoveva')).toEqual({
        firstName: 'Genoveva',
        lastName: 'Corona',
        name: 'Genoveva Corona',
      })
    })
  })

  describe('parseListCsv', () => {
    it('parses the standard template headers including DOB', () => {
      const csv = [
        'Patient Name,Email Address,Phone Number,Date of Birth',
        'Jane Doe,jane@example.com,+15551234567,1990-01-15',
        'John Smith,john@example.com,5559876543,01/20/1985',
      ].join('\n')

      const parsed = parseListCsv(csv)
      expect(parsed.errors).toEqual([])
      expect(parsed.rows).toEqual([
        {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+15551234567',
          dateOfBirth: '1990-01-15',
        },
        {
          name: 'John Smith',
          email: 'john@example.com',
          phone: '5559876543',
          dateOfBirth: '01/20/1985',
        },
      ])
    })

    it('accepts alias headers including DOB', () => {
      const csv = ['Name,Email,Phone,DOB', 'Ada Lovelace,ada@example.com,5551112222,1815-12-10'].join(
        '\n'
      )
      const parsed = parseListCsv(csv)
      expect(parsed.errors).toEqual([])
      expect(parsed.rows).toHaveLength(1)
      expect(parsed.rows[0]).toEqual({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: '5551112222',
        dateOfBirth: '1815-12-10',
      })
    })

    it('still parses rows when DOB column is omitted', () => {
      const csv = ['Patient Name,Email Address,Phone Number', 'Jane Doe,jane@example.com,555'].join(
        '\n'
      )
      const parsed = parseListCsv(csv)
      expect(parsed.errors).toEqual([])
      expect(parsed.rows[0].dateOfBirth).toBe('')
    })

    it('re-aligns unquoted comma-delimited names so phone/email stay mapped', () => {
      const csv = [
        'Patient Name,Email Address,Phone Number,Date of Birth',
        'Corona,Genoveva,,7131234567,1960-01-01',
      ].join('\n')
      const parsed = parseListCsv(csv)
      expect(parsed.errors).toEqual([])
      expect(parsed.rows[0]).toEqual({
        name: 'Corona,Genoveva',
        email: '',
        phone: '7131234567',
        dateOfBirth: '1960-01-01',
      })
    })

    it('requires patient name column', () => {
      const csv = ['Email Address,Phone Number', 'a@b.com,555'].join('\n')
      const parsed = parseListCsv(csv)
      expect(parsed.errors.some((e) => e.includes('Patient Name'))).toBe(true)
    })

    it('skips blank data rows', () => {
      const csv = [
        'Patient Name,Email Address,Phone Number,Date of Birth',
        ',,,',
        'Jane,,555,',
      ].join('\n')
      const parsed = parseListCsv(csv)
      expect(parsed.rows).toEqual([
        { name: 'Jane', email: '', phone: '555', dateOfBirth: '' },
      ])
    })
  })
})
