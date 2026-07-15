import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/integrations/opendental/appointmentSync', () => ({
  syncOpenDentalAppointmentsForPatient: vi.fn(),
}))

describe('refreshPatientAppointmentsFromOpenDentalForVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns sync summary when Open Dental pull succeeds', async () => {
    const { syncOpenDentalAppointmentsForPatient } = await import(
      '@/lib/integrations/opendental/appointmentSync'
    )
    vi.mocked(syncOpenDentalAppointmentsForPatient).mockResolvedValue({
      fetched: 2,
      created: 1,
      updated: 1,
      skipped: 0,
      errors: 0,
      errorSamples: [],
    })

    const { refreshPatientAppointmentsFromOpenDentalForVoice } = await import(
      '@/lib/appointments/live-opendental-refresh'
    )
    const result = await refreshPatientAppointmentsFromOpenDentalForVoice({
      practiceId: 'practice-1',
      patientId: 'patient-1',
    })

    expect(syncOpenDentalAppointmentsForPatient).toHaveBeenCalledWith({
      practiceId: 'practice-1',
      patientId: 'patient-1',
    })
    expect(result.attempted).toBe(true)
    expect(result.error).toBeNull()
    expect(result.summary?.fetched).toBe(2)
  })

  it('does not throw when Open Dental pull fails', async () => {
    const { syncOpenDentalAppointmentsForPatient } = await import(
      '@/lib/integrations/opendental/appointmentSync'
    )
    vi.mocked(syncOpenDentalAppointmentsForPatient).mockRejectedValue(new Error('OD down'))

    const { refreshPatientAppointmentsFromOpenDentalForVoice } = await import(
      '@/lib/appointments/live-opendental-refresh'
    )
    const result = await refreshPatientAppointmentsFromOpenDentalForVoice({
      practiceId: 'practice-1',
      patientId: 'patient-1',
    })

    expect(result.attempted).toBe(true)
    expect(result.summary).toBeNull()
    expect(result.error).toBe('OD down')
  })
})
