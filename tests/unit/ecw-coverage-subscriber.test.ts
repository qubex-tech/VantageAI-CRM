import { describe, expect, it } from 'vitest'
import { parseEcwCoverageResource } from '@/lib/ehr/vantageEcwBackend'

describe('parseEcwCoverageResource subscriber identity', () => {
  it('reads subscriber names from Coverage.subscriber.display', () => {
    const parsed = parseEcwCoverageResource({
      resourceType: 'Coverage',
      id: 'cov-1',
      subscriberId: 'ABC123',
      relationship: { coding: [{ code: 'child', display: 'Child' }] },
      subscriber: { reference: 'Patient/sub-1', display: 'SMITH, JANE' },
      payor: [{ reference: 'Organization/org-1' }],
    })

    expect(parsed).toMatchObject({
      memberId: 'ABC123',
      subscriberIsPatient: false,
      relationshipToPatient: 'Child',
      subscriberFirstName: 'JANE',
      subscriberLastName: 'SMITH',
      subscriberPatientId: 'sub-1',
    })
  })

  it('reads subscriber names and DOB from a contained Patient', () => {
    const parsed = parseEcwCoverageResource({
      resourceType: 'Coverage',
      id: 'cov-2',
      subscriberId: 'XYZ999',
      relationship: { coding: [{ code: 'spouse', display: 'Spouse' }] },
      subscriber: { reference: '#holder' },
      contained: [
        {
          resourceType: 'Patient',
          id: 'holder',
          name: [{ family: 'Rivera', given: ['Carlos'] }],
          birthDate: '1978-04-12',
        },
      ],
    })

    expect(parsed).toMatchObject({
      subscriberIsPatient: false,
      relationshipToPatient: 'Spouse',
      subscriberFirstName: 'Carlos',
      subscriberLastName: 'Rivera',
      subscriberDob: '1978-04-12',
    })
  })

  it('does not copy subscriber names when the patient is the subscriber', () => {
    const parsed = parseEcwCoverageResource({
      resourceType: 'Coverage',
      id: 'cov-3',
      subscriberId: 'SELF1',
      relationship: { coding: [{ code: 'self', display: 'Self' }] },
      subscriber: { reference: 'Patient/self-1', display: 'DOE, JOHN' },
    })

    expect(parsed).toMatchObject({
      subscriberIsPatient: true,
      subscriberFirstName: undefined,
      subscriberLastName: undefined,
    })
  })
})
