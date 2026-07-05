import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  resolvePostCallPatientMatch,
  type PatientIdentityRow,
} from '@/lib/patient-identity'

vi.mock('@/lib/integrations/opendental/factory', () => ({
  getOpenDentalServices: vi.fn(),
  getOpenDentalConnection: vi.fn(),
}))

import { getOpenDentalConnection, getOpenDentalServices } from '@/lib/integrations/opendental/factory'

const practiceId = 'practice-1'

function row(overrides: Partial<PatientIdentityRow> & { id: string }): PatientIdentityRow {
  return {
    name: 'Unknown',
    dateOfBirth: null,
    phone: null,
    primaryPhone: null,
    externalEhrId: null,
    ...overrides,
  }
}

describe('resolvePostCallPatientMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOpenDentalConnection).mockResolvedValue({ isActive: true } as never)
  })

  it('matches via Open Dental chart when CRM display name differs (Amin vs Amir)', async () => {
    const odLinked = row({
      id: 'c3463ef0',
      name: 'Amin Thobani',
      firstName: 'Amir',
      lastName: 'Thobani',
      dateOfBirth: new Date('1965-12-13T00:00:00.000Z'),
      phone: '6309652880',
      externalEhrId: 'opendental:2274',
    })

    vi.mocked(getOpenDentalServices).mockResolvedValue({
      patients: {
        get: vi.fn().mockResolvedValue({
          FName: 'Amir',
          LName: 'Thobani',
          Birthdate: '1965-12-13',
          WirelessPhone: '(630)965-2880',
        }),
      },
    } as never)

    const result = await resolvePostCallPatientMatch(
      practiceId,
      [odLinked],
      { name: 'Amir Thobani', dateOfBirth: '1965-12-13' },
      '+16309652880'
    )

    expect(result.blockCreate).toBe(false)
    expect(result.patient?.id).toBe('c3463ef0')
  })

  it('blocks create when phone is shared and identity matches no chart', async () => {
    const odLinked = row({
      id: 'c3463ef0',
      name: 'Amin Thobani',
      firstName: 'Amir',
      lastName: 'Thobani',
      dateOfBirth: new Date('1965-12-13T00:00:00.000Z'),
      phone: '6309652880',
      externalEhrId: 'opendental:2274',
    })
    const duplicate = row({
      id: 'fee6d5b3',
      name: 'Amir Thobani',
      dateOfBirth: new Date('1967-12-13T00:00:00.000Z'),
      phone: '16309652880',
    })

    vi.mocked(getOpenDentalServices).mockResolvedValue({
      patients: {
        get: vi.fn().mockResolvedValue({
          FName: 'Amir',
          LName: 'Thobani',
          Birthdate: '1965-12-13',
        }),
      },
    } as never)

    const result = await resolvePostCallPatientMatch(
      practiceId,
      [odLinked, duplicate],
      { name: 'Amin Thobani', dateOfBirth: '1964-12-13' },
      '6309652880'
    )

    expect(result.patient).toBeNull()
    expect(result.blockCreate).toBe(true)
  })

  it('matches exact CRM demographics without Open Dental', async () => {
    const existing = row({
      id: 'p1',
      name: 'Jane Doe',
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-15T00:00:00.000Z'),
      phone: '5551234567',
    })

    const result = await resolvePostCallPatientMatch(
      practiceId,
      [existing],
      { name: 'Jane Doe', dateOfBirth: '1990-01-15' },
      '5551234567'
    )

    expect(result).toEqual({ patient: existing, blockCreate: false })
  })

  it('reuses sole phone match when caller did not provide full identity', async () => {
    const existing = row({
      id: 'p1',
      name: 'Jane Doe',
      phone: '5551234567',
    })

    const result = await resolvePostCallPatientMatch(
      practiceId,
      [existing],
      { name: 'Jane Doe' },
      '5551234567'
    )

    expect(result.patient?.id).toBe('p1')
    expect(result.blockCreate).toBe(false)
  })
})
