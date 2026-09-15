import { describe, expect, it } from 'vitest'
import {
  demographicsMatch,
  normalizeDobToIso,
  patientDobMatches,
  patientNamesMatch,
  resolveDemographics,
} from '@/lib/patient-identity'

describe('resolvePatientByContact helpers', () => {
  it('matches patients by full name and DOB', () => {
    const patient = {
      id: 'a',
      name: 'Steve Madden',
      firstName: 'Steve',
      lastName: 'Madden',
      dateOfBirth: new Date('1992-01-23T00:00:00.000Z'),
    }
    expect(
      demographicsMatch(patient, {
        name: 'Steve Madden',
        dateOfBirth: '1992-01-23',
      })
    ).toBe(true)
    expect(
      demographicsMatch(patient, {
        name: 'Steve Madden',
        dateOfBirth: '1996-01-06',
      })
    ).toBe(false)
  })

  it('detects first+last name mismatches independent of DOB', () => {
    const amir = {
      id: 'a',
      name: 'Amin Thobani',
      firstName: 'Amir',
      lastName: 'Thobani',
      dateOfBirth: new Date('1965-12-13T00:00:00.000Z'),
    }
    expect(patientNamesMatch(amir, { name: 'Amin Thobani' })).toBe(false)
    expect(patientNamesMatch(amir, { name: 'Amir Thobani' })).toBe(true)
  })

  it('normalizes DOB for comparison', () => {
    expect(normalizeDobToIso('1/23/1992')).toBe('1992-01-23')
    expect(resolveDemographics({ dateOfBirth: '1996-01-06' }).dateOfBirth).toBe('1996-01-06')
  })

  it('parses Retell natural-language DOBs including day ordinals', () => {
    expect(normalizeDobToIso('December 13, 1965')).toBe('1965-12-13')
    expect(normalizeDobToIso('December 13th, 1965')).toBe('1965-12-13')
    expect(normalizeDobToIso('April 1st, 1986')).toBe('1986-04-01')
    expect(normalizeDobToIso('March 2nd, 1990')).toBe('1990-03-02')
    expect(normalizeDobToIso('May 3rd, 2001')).toBe('2001-05-03')

    const existing = {
      id: 'amir',
      name: 'Amir Thobani',
      firstName: 'Amir',
      lastName: 'Thobani',
      dateOfBirth: new Date('1965-12-13T00:00:00.000Z'),
    }
    expect(
      demographicsMatch(existing, {
        name: 'Amir Thobani',
        dateOfBirth: 'December 13th, 1965',
      })
    ).toBe(true)
  })

  it('matches DOB alone for disambiguation', () => {
    const patient = {
      id: 'a',
      name: 'Steve Madden',
      firstName: 'Steve',
      lastName: 'Madden',
      dateOfBirth: new Date('1992-01-23T00:00:00.000Z'),
    }
    expect(patientDobMatches(patient, '1992-01-23')).toBe(true)
    expect(patientDobMatches(patient, '1996-01-06')).toBe(false)
  })
})
