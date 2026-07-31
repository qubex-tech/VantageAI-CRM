import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isOpenDentalPatientActive } from '@/lib/integrations/opendental/patientSync'

vi.mock('@/lib/integrations/opendental/factory', () => ({
  getOpenDentalConnection: vi.fn(),
  getOpenDentalServices: vi.fn(),
}))

import { getOpenDentalConnection, getOpenDentalServices } from '@/lib/integrations/opendental/factory'
import { fetchOpenDentalChartFacts } from '@/lib/patient-identity'

describe('Open Dental deleted chart handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('treats Deleted/Archived/Deceased as inactive', () => {
    expect(isOpenDentalPatientActive({ PatStatus: 'Patient' })).toBe(true)
    expect(isOpenDentalPatientActive({ PatStatus: 'Deleted' })).toBe(false)
    expect(isOpenDentalPatientActive({ PatStatus: 'Archived' })).toBe(false)
    expect(isOpenDentalPatientActive({ PatStatus: 'Deceased' })).toBe(false)
  })

  it('fetchOpenDentalChartFacts returns null for Deleted PatStatus', async () => {
    vi.mocked(getOpenDentalConnection).mockResolvedValue({ isActive: true } as never)
    vi.mocked(getOpenDentalServices).mockResolvedValue({
      patients: {
        get: vi.fn().mockResolvedValue({
          PatNum: 12458,
          FName: 'Salim',
          LName: 'Rahim',
          Birthdate: '1965-12-13',
          PatStatus: 'Deleted',
          WirelessPhone: '1(630)965-2880',
        }),
      },
    } as never)

    await expect(
      fetchOpenDentalChartFacts('practice-1', 'opendental:12458')
    ).resolves.toBeNull()
  })

  it('fetchOpenDentalChartFacts returns facts for active Patient status', async () => {
    vi.mocked(getOpenDentalConnection).mockResolvedValue({ isActive: true } as never)
    vi.mocked(getOpenDentalServices).mockResolvedValue({
      patients: {
        get: vi.fn().mockResolvedValue({
          PatNum: 12458,
          FName: 'Salim',
          LName: 'Rahim',
          Birthdate: '1965-12-13',
          PatStatus: 'Patient',
          WirelessPhone: '1(630)965-2880',
        }),
      },
    } as never)

    await expect(
      fetchOpenDentalChartFacts('practice-1', 'opendental:12458')
    ).resolves.toEqual({
      pat_num: 12458,
      first_name: 'Salim',
      last_name: 'Rahim',
      birthdate: '1965-12-13',
      wireless_phone: '1(630)965-2880',
    })
  })
})
