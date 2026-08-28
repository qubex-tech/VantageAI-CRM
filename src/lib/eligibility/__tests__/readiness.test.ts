import { describe, expect, it } from 'vitest'
import { computeEligibilityReadiness } from '../readiness'

describe('computeEligibilityReadiness', () => {
  const patient = {
    firstName: 'Mariam',
    lastName: 'Khan',
    dateOfBirth: new Date('1984-07-06'),
  }

  it('does not block a 270 when subscriber DOB is missing', () => {
    const result = computeEligibilityReadiness({
      policy: {
        payerNameRaw: 'AETNA',
        memberId: 'W187144546',
        subscriberIsPatient: false,
        subscriberFirstName: 'Muzaffer',
        subscriberLastName: 'Khan',
        subscriberDob: null,
        relationshipToPatient: 'Spouse',
      },
      patient,
      providerNpi: '1386814440',
      payerId: '60054',
    })

    expect(result.ready).toBe(true)
    expect(result.missingFields).not.toContain('subscriber.dob')
    expect(result.warnings.some((warning) => warning.includes('subscriber.dob'))).toBe(true)
  })

  it('blocks a 270 when subscriber names are missing for a dependent', () => {
    const result = computeEligibilityReadiness({
      policy: {
        payerNameRaw: 'AETNA',
        memberId: 'W187144546',
        subscriberIsPatient: false,
        subscriberFirstName: null,
        subscriberLastName: null,
        subscriberDob: null,
        relationshipToPatient: 'Child',
      },
      patient,
      providerNpi: '1386814440',
      payerId: '60054',
    })

    expect(result.ready).toBe(false)
    expect(result.missingFields).toEqual(
      expect.arrayContaining(['subscriber.first_name', 'subscriber.last_name'])
    )
  })
})
