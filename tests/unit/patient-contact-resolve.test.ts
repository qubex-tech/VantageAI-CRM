import { describe, expect, it } from 'vitest'
import {
  demographicsMatch,
  normalizeDobToIso,
  patientDobMatches,
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

  it('normalizes DOB for comparison', () => {
    expect(normalizeDobToIso('1/23/1992')).toBe('1992-01-23')
    expect(resolveDemographics({ dateOfBirth: '1996-01-06' }).dateOfBirth).toBe('1996-01-06')
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
