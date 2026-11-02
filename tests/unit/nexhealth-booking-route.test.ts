import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    patient: { findFirst: vi.fn() },
    appointment: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/lib/integrations/clinical-system/server', () => ({
  getSchedulingSettings: vi.fn(),
}))

vi.mock('@/lib/integrations/nexhealth/scheduling', () => ({
  ensureNexhealthPatientLinked: vi.fn(),
  bookNexhealthAppointment: vi.fn(),
  getNexhealthOpenSlots: vi.fn(),
  cancelNexhealthAppointment: vi.fn(),
}))

import { bookAppointment } from '@/lib/agentActions'
import { prisma } from '@/lib/db'
import { getSchedulingSettings } from '@/lib/integrations/clinical-system/server'
import {
  bookNexhealthAppointment,
  ensureNexhealthPatientLinked,
} from '@/lib/integrations/nexhealth/scheduling'

const scheduling = {
  readSource: 'nexhealth' as const,
  writeSource: 'nexhealth' as const,
}

describe('bookAppointment NexHealth routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSchedulingSettings).mockResolvedValue(scheduling)
  })

  it('books through NexHealth when the patient is linked', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'patient-1',
      practiceId: 'practice-1',
      deletedAt: null,
      externalEhrId: 'nexhealth:415',
      name: 'Ada Lovelace',
    } as never)
    vi.mocked(ensureNexhealthPatientLinked).mockResolvedValue({
      id: 'patient-1',
      externalEhrId: 'nexhealth:415',
    })
    vi.mocked(bookNexhealthAppointment).mockResolvedValue({
      appointmentId: 'appt-1',
      calBookingId: 'nexhealth:apt:1822',
      startTime: '2026-12-01T15:00:00.000Z',
      endTime: '2026-12-01T15:30:00.000Z',
      confirmationMessage: 'booked',
    })

    const result = await bookAppointment(
      'practice-1',
      'patient-1',
      'event-1',
      '2026-12-01T15:00:00.000Z'
    )

    expect(ensureNexhealthPatientLinked).toHaveBeenCalled()
    expect(bookNexhealthAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceId: 'practice-1',
        patientId: 'patient-1',
        externalEhrId: 'nexhealth:415',
      })
    )
    expect(result.calBookingId).toBe('nexhealth:apt:1822')
  })

  it('refuses a patient that is still not linked to NexHealth', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'patient-1',
      practiceId: 'practice-1',
      deletedAt: null,
      externalEhrId: 'opendental:44',
      name: 'Ada Lovelace',
    } as never)
    vi.mocked(ensureNexhealthPatientLinked).mockResolvedValue({
      id: 'patient-1',
      externalEhrId: 'opendental:44',
    })

    await expect(
      bookAppointment('practice-1', 'patient-1', 'event-1', '2026-12-01T15:00:00.000Z')
    ).rejects.toThrow(/not linked to NexHealth/)
    expect(bookNexhealthAppointment).not.toHaveBeenCalled()
  })
})
