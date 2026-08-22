import { describe, expect, it } from 'vitest'
import { getPayerIdForVendor, upsertPayerIdMap } from '../payer-ids'
import { mapToCanonicalEligibilityRequest } from '../canonical-request'

describe('payer ID map', () => {
  it('falls back to availityPayerId for the availity vendor', () => {
    expect(
      getPayerIdForVendor({ availityPayerId: 'AETNA', clearinghousePayerIds: null }, 'availity')
    ).toBe('AETNA')
  })

  it('prefers the vendor-keyed map over the legacy column', () => {
    expect(
      getPayerIdForVendor(
        { availityPayerId: 'AETNA', clearinghousePayerIds: { availity: 'BCBSF', stedi: '87726' } },
        'availity'
      )
    ).toBe('BCBSF')
    expect(
      getPayerIdForVendor(
        { availityPayerId: 'AETNA', clearinghousePayerIds: { availity: 'BCBSF', stedi: '87726' } },
        'stedi'
      )
    ).toBe('87726')
  })

  it('does not reuse an Availity ID for Stedi', () => {
    expect(
      getPayerIdForVendor({ availityPayerId: 'AETNA', clearinghousePayerIds: null }, 'stedi')
    ).toBeNull()
  })

  it('upserts without dropping other vendors', () => {
    const next = upsertPayerIdMap({ availity: 'AETNA' }, 'stedi', '87726')
    expect(next).toEqual({ availity: 'AETNA', stedi: '87726' })
  })
})

describe('canonical eligibility request', () => {
  it('maps patient as subscriber when subscriberIsPatient', () => {
    const request = mapToCanonicalEligibilityRequest({
      practiceId: 'p1',
      patient: { firstName: 'Jane', lastName: 'Doe', dateOfBirth: '1990-01-15' },
      policy: { memberId: 'M123456789', subscriberIsPatient: true },
      payerId: '87726',
      providerNpi: '1999999984',
      serviceType: '30',
      providerOrganizationName: 'Lonestar Rheumatology',
    })
    expect(request.subscriberIsPatient).toBe(true)
    expect(request.patientFirstName).toBe('Jane')
    expect(request.patientBirthDate).toBe('1990-01-15')
    expect(request.serviceTypeCodes).toEqual(['30'])
  })

  it('keeps multiple selected service type codes', () => {
    const request = mapToCanonicalEligibilityRequest({
      practiceId: 'p1',
      patient: { firstName: 'Jane', lastName: 'Doe', dateOfBirth: '1990-01-15' },
      policy: { memberId: 'M123456789', subscriberIsPatient: true },
      payerId: '64246',
      providerNpi: '1215142500',
      serviceType: '35',
      serviceTypeCodes: ['35', '23', '41'],
      providerOrganizationName: 'Advanced Family Dental',
    })
    expect(request.serviceType).toBe('35')
    expect(request.serviceTypeCodes).toEqual(['35', '23', '41'])
  })
})
