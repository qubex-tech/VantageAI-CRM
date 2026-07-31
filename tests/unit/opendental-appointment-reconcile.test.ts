import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    patient: { findFirst: vi.fn() },
    appointment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

vi.mock('@/lib/integrations/opendental/factory', () => ({
  getOpenDentalConnection: vi.fn(),
  getOpenDentalServices: vi.fn(),
}))

vi.mock('@/lib/practice-timezone', () => ({
  getPracticeTimeZone: vi.fn().mockResolvedValue('America/Chicago'),
}))

vi.mock('@/lib/appointment-optimization/appointmentChangeHandler', () => ({
  handleAppointmentChangeForSlotFill: vi.fn(),
}))

vi.mock('@/lib/integrations/opendental/connectionManager', () => ({
  recordSyncResult: vi.fn(),
}))

vi.mock('@/lib/integrations/opendental/audit', () => ({
  logOpenDentalAudit: vi.fn(),
}))

import { prisma } from '@/lib/db'
import { getOpenDentalConnection, getOpenDentalServices } from '@/lib/integrations/opendental/factory'
import {
  isOpenDentalVoiceUpcomingStatus,
  reconcileOpenDentalAppointmentsForPatient,
} from '@/lib/integrations/opendental/appointmentSync'

describe('isOpenDentalVoiceUpcomingStatus', () => {
  it('only allows Scheduled and ASAP', () => {
    expect(isOpenDentalVoiceUpcomingStatus('Scheduled')).toBe(true)
    expect(isOpenDentalVoiceUpcomingStatus('ASAP')).toBe(true)
    expect(isOpenDentalVoiceUpcomingStatus('Broken')).toBe(false)
    expect(isOpenDentalVoiceUpcomingStatus('Complete')).toBe(false)
    expect(isOpenDentalVoiceUpcomingStatus('UnschedList')).toBe(false)
  })
})

describe('reconcileOpenDentalAppointmentsForPatient prune', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      externalEhrId: 'opendental:2274',
    } as never)
    vi.mocked(getOpenDentalConnection).mockResolvedValue({ isActive: true } as never)
    vi.mocked(prisma.appointment.upsert).mockResolvedValue({
      id: 'crm-1',
      practiceId: 'practice-1',
      providerId: 'prov:24',
      status: 'scheduled',
      startTime: new Date(),
      endTime: new Date(),
      timezone: 'America/Chicago',
      visitType: 'Open Dental Appointment',
    } as never)
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null)
  })

  it('cancels CRM OD apts whose AptNum is absent from the live OD list', async () => {
    vi.mocked(getOpenDentalServices).mockResolvedValue({
      appointments: {
        list: vi.fn().mockResolvedValue([]),
      },
    } as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        id: 'ghost-apt',
        calBookingId: 'opendental:apt:72367',
        status: 'scheduled',
      },
    ] as never)
    vi.mocked(prisma.appointment.update).mockResolvedValue({} as never)

    const result = await reconcileOpenDentalAppointmentsForPatient({
      practiceId: 'practice-1',
      patientId: 'patient-1',
    })

    expect(result.summary.pruned).toBe(1)
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'ghost-apt' },
      data: { status: 'cancelled' },
    })
  })

  it('reconciles Broken live OD status onto CRM as cancelled', async () => {
    vi.mocked(getOpenDentalServices).mockResolvedValue({
      appointments: {
        list: vi.fn().mockResolvedValue([
          {
            AptNum: 72367,
            PatNum: 2274,
            AptStatus: 'Broken',
            AptDateTime: '2026-08-15 09:00:00',
            Pattern: 'XXXXXX',
          },
        ]),
      },
    } as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        id: 'broken-apt',
        calBookingId: 'opendental:apt:72367',
        status: 'scheduled',
      },
    ] as never)
    vi.mocked(prisma.appointment.update).mockResolvedValue({} as never)

    const result = await reconcileOpenDentalAppointmentsForPatient({
      practiceId: 'practice-1',
      patientId: 'patient-1',
    })

    expect(result.summary.statusReconciled).toBe(1)
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'broken-apt' },
      data: { status: 'cancelled' },
    })
  })
})
