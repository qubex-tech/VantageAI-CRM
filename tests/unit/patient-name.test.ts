import { describe, expect, it } from 'vitest'
import {
  formatFhirHumanName,
  formatFhirPatientDisplayName,
  formatPatientDisplayName,
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
