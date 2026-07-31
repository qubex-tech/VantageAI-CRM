import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    appointment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/integrations/opendental/appointmentSync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/integrations/opendental/appointmentSync')>()
  return {
    ...actual,
    reconcileOpenDentalAppointmentsForPatient: vi.fn(),
    syncOpenDentalAppointmentsForPatient: vi.fn(),
  }
})

vi.mock('@/lib/appointment-optimization/appointmentChangeHandler', () => ({
  handleAppointmentChangeForSlotFill: vi.fn(),
}))

import { prisma } from '@/lib/db'
import { reconcileOpenDentalAppointmentsForPatient } from '@/lib/integrations/opendental/appointmentSync'

describe('refreshPatientAppointmentsFromOpenDentalForVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns sync summary when Open Dental pull succeeds', async () => {
    vi.mocked(reconcileOpenDentalAppointmentsForPatient).mockResolvedValue({
      summary: {
        fetched: 2,
        created: 1,
        updated: 1,
        skipped: 0,
        errors: 0,
        errorSamples: [],
        pruned: 0,
        statusReconciled: 0,
      },
      timeZone: 'America/Chicago',
      patNum: 2274,
      liveOdAppointments: [],
      linked: true,
      configured: true,
    })

    const { refreshPatientAppointmentsFromOpenDentalForVoice } = await import(
      '@/lib/appointments/live-opendental-refresh'
    )
    const result = await refreshPatientAppointmentsFromOpenDentalForVoice({
      practiceId: 'practice-1',
      patientId: 'patient-1',
    })

    expect(reconcileOpenDentalAppointmentsForPatient).toHaveBeenCalledWith({
      practiceId: 'practice-1',
      patientId: 'patient-1',
    })
    expect(result.attempted).toBe(true)
    expect(result.error).toBeNull()
    expect(result.summary?.fetched).toBe(2)
  })

  it('does not throw when Open Dental pull fails', async () => {
    vi.mocked(reconcileOpenDentalAppointmentsForPatient).mockRejectedValue(new Error('OD down'))

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

describe('getLiveUpcomingAppointmentsForVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not return a CRM-only ghost when that AptNum is missing from the live OD list', async () => {
    vi.mocked(reconcileOpenDentalAppointmentsForPatient).mockResolvedValue({
      summary: {
        fetched: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        errorSamples: [],
        pruned: 1,
        statusReconciled: 0,
      },
      timeZone: 'America/Chicago',
      patNum: 2274,
      // Live OD list is empty — ghost apt:72367 is gone
      liveOdAppointments: [],
      linked: true,
      configured: true,
    })

    const { getLiveUpcomingAppointmentsForVoice } = await import(
      '@/lib/appointments/live-opendental-refresh'
    )
    const result = await getLiveUpcomingAppointmentsForVoice({
      practiceId: 'practice-1',
      patientId: 'patient-1',
    })

    expect(result.appointments).toEqual([])
    expect(result.error).toBeNull()
    expect(result.refreshedFromOpenDental).toBe(true)
    expect(prisma.appointment.findUnique).not.toHaveBeenCalled()
  })

  it('returns only live OD upcoming appointments (with CRM ids for cancel)', async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const y = future.getUTCFullYear()
    const m = String(future.getUTCMonth() + 1).padStart(2, '0')
    const d = String(future.getUTCDate()).padStart(2, '0')

    vi.mocked(reconcileOpenDentalAppointmentsForPatient).mockResolvedValue({
      summary: {
        fetched: 1,
        created: 0,
        updated: 1,
        skipped: 0,
        errors: 0,
        errorSamples: [],
        pruned: 0,
        statusReconciled: 0,
      },
      timeZone: 'America/Chicago',
      patNum: 2274,
      liveOdAppointments: [
        {
          AptNum: 80001,
          PatNum: 2274,
          AptStatus: 'Scheduled',
          // Midday Chicago so parse is safely in the future for most test runs
          AptDateTime: `${y}-${m}-${d} 14:00:00`,
          ProvNum: 24,
          Pattern: 'XXXXXX',
          Note: 'checkup',
          ProcDescript: 'Cleaning',
        } as never,
      ],
      linked: true,
      configured: true,
    })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({
      id: 'crm-apt-1',
      status: 'scheduled',
      startTime: future,
      endTime: new Date(future.getTime() + 30 * 60_000),
      timezone: 'America/Chicago',
      visitType: 'Cleaning',
      reason: 'Cleaning',
      notes: 'Synced from Open Dental Appointment/80001 — checkup',
      providerId: 'prov:24',
    } as never)

    const { getLiveUpcomingAppointmentsForVoice } = await import(
      '@/lib/appointments/live-opendental-refresh'
    )
    const result = await getLiveUpcomingAppointmentsForVoice({
      practiceId: 'practice-1',
      patientId: 'patient-1',
    })

    expect(result.error).toBeNull()
    expect(result.appointments).toHaveLength(1)
    expect(result.appointments[0].id).toBe('crm-apt-1')
    expect(prisma.appointment.findUnique).toHaveBeenCalledWith({
      where: { calBookingId: 'opendental:apt:80001' },
      select: expect.any(Object),
    })
  })

  it('fails closed on OD errors without reading CRM', async () => {
    vi.mocked(reconcileOpenDentalAppointmentsForPatient).mockRejectedValue(
      new Error('OD connection reset')
    )

    const { getLiveUpcomingAppointmentsForVoice } = await import(
      '@/lib/appointments/live-opendental-refresh'
    )
    const result = await getLiveUpcomingAppointmentsForVoice({
      practiceId: 'practice-1',
      patientId: 'patient-1',
    })

    expect(result.appointments).toEqual([])
    expect(result.error).toBe('OD connection reset')
    expect(result.refreshedFromOpenDental).toBe(false)
    expect(prisma.appointment.findUnique).not.toHaveBeenCalled()
    expect(prisma.appointment.findMany).not.toHaveBeenCalled()
  })
})
