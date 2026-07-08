import { describe, expect, it } from 'vitest'
import { mapToCoverageInquiryRequest, coverageRequestToFormBody } from '@/lib/availity/map-request'

describe('mapToCoverageInquiryRequest', () => {
  it('maps patient and policy to Availity coverage request', () => {
    const request = mapToCoverageInquiryRequest({
      patient: {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-05-15'),
        state: 'FL',
        gender: 'female',
      },
      policy: {
        memberId: 'ABC123456',
        groupNumber: 'GRP99',
        subscriberIsPatient: true,
      },
      payerId: 'BCBSF',
      providerNpi: '1234567890',
      serviceType: '30',
    })

    expect(request.payerId).toBe('BCBSF')
    expect(request.memberId).toBe('ABC123456')
    expect(request.patientFirstName).toBe('Jane')
    expect(request.patientLastName).toBe('Doe')
    expect(request.patientBirthDate).toBe('1990-05-15')
    expect(request.providerNpi).toBe('1234567890')
    expect(request.subscriberRelationship).toBe('18')
    expect(request.patientGender).toBe('F')
  })

  it('throws when availity payer id is missing', () => {
    expect(() =>
      mapToCoverageInquiryRequest({
        patient: { firstName: 'A', lastName: 'B', dateOfBirth: '1990-01-01' },
        policy: { memberId: 'X', subscriberIsPatient: true },
        payerId: '',
        providerNpi: '1234567890',
        serviceType: '30',
      })
    ).toThrow(/Availity payer ID/)
  })

  it('builds form body with serviceType array key', () => {
    const body = coverageRequestToFormBody({
      payerId: 'AETNA',
      memberId: 'M1',
      patientFirstName: 'John',
      patientLastName: 'Smith',
      patientBirthDate: '1985-03-01',
      providerNpi: '1234567890',
      serviceType: '30',
      subscriberRelationship: '18',
    })

    expect(body['serviceType[]']).toBe('30')
    expect(body.payerId).toBe('AETNA')
  })
})
