import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    patient: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/integrations/opendental/factory', () => ({
  getOpenDentalConnection: vi.fn(),
  getOpenDentalServices: vi.fn(),
}))

vi.mock('@/lib/integrations/opendental/patientSync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/integrations/opendental/patientSync')>()
  return {
    ...actual,
    upsertPatientFromOpenDental: vi.fn(),
  }
})

vi.mock('@/lib/integrations/ehr/scheduleSync', () => ({
  createEhrClientForPractice: vi.fn(),
}))

vi.mock('@/lib/integrations/ehr/ecwPatientRosterSync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/integrations/ehr/ecwPatientRosterSync')>()
  return {
    ...actual,
    upsertFhirPatientForPractice: vi.fn(),
  }
})

import { prisma } from '@/lib/db'
import { getOpenDentalConnection, getOpenDentalServices } from '@/lib/integrations/opendental/factory'
import { upsertPatientFromOpenDental } from '@/lib/integrations/opendental/patientSync'
import { createEhrClientForPractice } from '@/lib/integrations/ehr/scheduleSync'
import { upsertFhirPatientForPractice } from '@/lib/integrations/ehr/ecwPatientRosterSync'
import {
  extractFhirPatientsFromBundle,
  firstNameSearchVariants,
  fhirBirthdateMatches,
  openDentalBirthdateMatches,
  preferZipMatches,
  resolvePatientsFromLiveEhr,
  toDemographicMatches,
} from '@/lib/patients/live-ehr-demographic-resolve'

describe('live EHR demographic helpers', () => {
  it('adds a first-token variant for multi-word first names', () => {
    expect(firstNameSearchVariants('Salman Khan')).toEqual(['Salman Khan', 'Salman'])
    expect(firstNameSearchVariants('Lilith')).toEqual(['Lilith'])
  })

  it('keeps blank-ZIP patients when the spoken ZIP does not match', () => {
    const rows = [
      { id: 'tharwani', postalCode: null },
      { id: 'other', postalCode: '60601' },
    ]
    expect(preferZipMatches(rows, '60563').map((row) => row.id)).toEqual(['tharwani', 'other'])
  })

  it('prefers ZIP matches when any exist', () => {
    const rows = [
      { id: 'blank', postalCode: null },
      { id: 'match', postalCode: '60563' },
    ]
    expect(preferZipMatches(rows, '60563').map((row) => row.id)).toEqual(['match'])
  })

  it('matches Open Dental birthdates including neighbor-day candidates', () => {
    expect(openDentalBirthdateMatches('2019-06-25T00:00:00', ['2019-06-24', '2019-06-25', '2019-06-26'])).toBe(
      true
    )
    expect(openDentalBirthdateMatches('0001-01-01', ['2019-06-25'])).toBe(false)
  })

  it('extracts FHIR Patient resources from a search bundle', () => {
    const patients = extractFhirPatientsFromBundle({
      entry: [
        { resource: { resourceType: 'Patient', id: 'p1', birthDate: '2019-06-25' } },
        { resource: { resourceType: 'OperationOutcome' } },
      ],
    })
    expect(patients).toEqual([{ resourceType: 'Patient', id: 'p1', birthDate: '2019-06-25' }])
    expect(fhirBirthdateMatches('2019-06-25', ['2019-06-25'])).toBe(true)
  })

  it('marks ZIP confidence only when the stored ZIP matches', () => {
    const matches = toDemographicMatches(
      [
        {
          id: 'blank-zip',
          firstName: 'Salman',
          lastName: 'Tharwani',
          dateOfBirth: new Date('1979-05-24T00:00:00.000Z'),
          postalCode: null,
        },
      ],
      '60563'
    )
    expect(matches[0]?.confidence).toBe('medium')
    expect(matches[0]?.patient_id).toBe('blank-zip')
  })
})

describe('resolvePatientsFromLiveEhr', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('live-pulls Open Dental, upserts into CRM, and returns the new chart', async () => {
    vi.mocked(getOpenDentalConnection).mockResolvedValue({ isActive: true } as never)
    vi.mocked(getOpenDentalServices).mockResolvedValue({
      patients: {
        list: vi.fn().mockResolvedValue([
          {
            PatNum: 12513,
            FName: 'Lilith',
            LName: 'Mosser',
            Birthdate: '2019-06-25',
            PatStatus: 'Patient',
            Zip: '60563',
          },
        ]),
      },
    } as never)
    vi.mocked(upsertPatientFromOpenDental).mockResolvedValue({ id: 'crm-lilith', outcome: 'created' })
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      {
        id: 'crm-lilith',
        firstName: 'Lilith',
        lastName: 'Mosser',
        dateOfBirth: new Date('2019-06-25T00:00:00.000Z'),
        postalCode: '60563',
      },
    ] as never)

    const matches = await resolvePatientsFromLiveEhr({
      practiceId: 'practice-1',
      firstName: 'Lilith',
      lastName: 'Mosser',
      dobCandidates: ['2019-06-25'],
      zip: '60563',
    })

    expect(upsertPatientFromOpenDental).toHaveBeenCalled()
    expect(createEhrClientForPractice).not.toHaveBeenCalled()
    expect(matches).toEqual([
      {
        patient_id: 'crm-lilith',
        confidence: 'high',
        display: {
          first_name: 'Lilith',
          last_name: 'Mosser',
          dob: '2019-06-25',
          zip_masked: '****0563',
        },
      },
    ])
  })

  it('retries the first-name token when a multi-word first name misses', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          PatNum: 8592,
          FName: 'Salman  khan',
          LName: 'Tharwani',
          Birthdate: '1979-05-24',
          PatStatus: 'Patient',
          Zip: '',
        },
      ])
    vi.mocked(getOpenDentalConnection).mockResolvedValue({ isActive: true } as never)
    vi.mocked(getOpenDentalServices).mockResolvedValue({ patients: { list } } as never)
    vi.mocked(upsertPatientFromOpenDental).mockResolvedValue({ id: 'crm-salman', outcome: 'created' })
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      {
        id: 'crm-salman',
        firstName: 'Salman  khan',
        lastName: 'Tharwani',
        dateOfBirth: new Date('1979-05-24T00:00:00.000Z'),
        postalCode: null,
      },
    ] as never)

    const matches = await resolvePatientsFromLiveEhr({
      practiceId: 'practice-1',
      firstName: 'Salman Khan',
      lastName: 'Tharwani',
      dobCandidates: ['1979-05-24'],
      zip: '60563',
    })

    expect(list).toHaveBeenCalledWith({
      LName: 'Tharwani',
      FName: 'Salman',
      Birthdate: '1979-05-24',
    })
    expect(matches[0]?.patient_id).toBe('crm-salman')
    expect(matches[0]?.confidence).toBe('medium')
  })

  it('live-pulls eCW when Open Dental is not configured', async () => {
    vi.mocked(getOpenDentalConnection).mockResolvedValue(null)
    const searchPatients = vi.fn().mockResolvedValue({
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: 'ecw-1',
            birthDate: '2019-06-25',
            name: [{ given: ['Lilith'], family: 'Mosser' }],
          },
        },
      ],
    })
    vi.mocked(createEhrClientForPractice).mockResolvedValue({
      client: { searchPatients },
    } as never)
    vi.mocked(upsertFhirPatientForPractice).mockResolvedValue('imported')
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'crm-ecw',
      firstName: 'Lilith',
      lastName: 'Mosser',
      dateOfBirth: new Date('2019-06-25T00:00:00.000Z'),
      postalCode: '60563',
    } as never)
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      {
        id: 'crm-ecw',
        firstName: 'Lilith',
        lastName: 'Mosser',
        dateOfBirth: new Date('2019-06-25T00:00:00.000Z'),
        postalCode: '60563',
      },
    ] as never)

    const matches = await resolvePatientsFromLiveEhr({
      practiceId: 'practice-1',
      firstName: 'Lilith',
      lastName: 'Mosser',
      dobCandidates: ['2019-06-25'],
    })

    expect(searchPatients).toHaveBeenCalled()
    expect(upsertFhirPatientForPractice).toHaveBeenCalled()
    expect(matches[0]?.patient_id).toBe('crm-ecw')
  })

  it('returns an empty list instead of throwing when the EHR errors', async () => {
    vi.mocked(getOpenDentalConnection).mockResolvedValue({ isActive: true } as never)
    vi.mocked(getOpenDentalServices).mockRejectedValue(new Error('OD down'))
    vi.mocked(createEhrClientForPractice).mockRejectedValue(new Error('eCW down'))

    await expect(
      resolvePatientsFromLiveEhr({
        practiceId: 'practice-1',
        firstName: 'Lilith',
        lastName: 'Mosser',
        dobCandidates: ['2019-06-25'],
      })
    ).resolves.toEqual([])
  })
})
