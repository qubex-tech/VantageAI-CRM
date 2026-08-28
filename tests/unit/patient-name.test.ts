import { describe, expect, it } from 'vitest'
import {
  formatFhirHumanName,
  formatFhirPatientDisplayName,
  formatPatientDisplayName,
  namesFromFhirHumanName,
  splitPersonDisplayName,
} from '@/lib/patient-name'

describe('formatPatientDisplayName', () => {
  it('prefers firstName + lastName over legacy name', () => {
    expect(
      formatPatientDisplayName({
        name: 'King Nicole',
        firstName: 'Nicole',
        lastName: 'King',
      })
    ).toBe('Nicole King')
  })

  it('falls back to legacy name when structured fields are empty', () => {
    expect(formatPatientDisplayName({ name: 'Nicole King' })).toBe('Nicole King')
  })
})

describe('formatFhirPatientDisplayName', () => {
  it('prefers given + family over eCW last-first name.text', () => {
    expect(
      formatFhirPatientDisplayName({
        name: [
          {
            text: 'King Nicole',
            family: 'King',
            given: ['Nicole'],
          },
        ],
      })
    ).toBe('Nicole King')
  })

  it('falls back to name.text when given/family are missing', () => {
    expect(formatFhirHumanName({ text: 'Nicole King' })).toBe('Nicole King')
  })

  it('joins multiple given names before family', () => {
    expect(
      formatFhirHumanName({
        family: 'King',
        given: ['Nicole', 'Marie'],
      })
    ).toBe('Nicole Marie King')
  })
})

describe('splitPersonDisplayName', () => {
  it('parses eCW last-comma-first display', () => {
    expect(splitPersonDisplayName('DOE, JANE')).toEqual({
      firstName: 'JANE',
      lastName: 'DOE',
    })
  })

  it('parses first last display', () => {
    expect(splitPersonDisplayName('Jane Doe')).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
    })
  })
})

describe('namesFromFhirHumanName', () => {
  it('prefers given and family over last-first text', () => {
    expect(
      namesFromFhirHumanName({
        text: 'King Nicole',
        family: 'King',
        given: ['Nicole'],
      })
    ).toEqual({ firstName: 'Nicole', lastName: 'King' })
  })
})
