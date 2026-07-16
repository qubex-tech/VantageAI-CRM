import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { getSchedulingSettings } from '@/lib/integrations/clinical-system/server'
import { createOpenDentalPatientFromCrm } from '@/lib/integrations/opendental/patientWriteback'
import { bookOpenDentalAppointment } from '@/lib/integrations/opendental/scheduling'

vi.mock('@/lib/db', () => ({
  prisma: {
    patient: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/integrations/clinical-system/server', () => ({
  getSchedulingSettings: vi.fn(),
}))

vi.mock('@/lib/integrations/opendental/patientWriteback', () => ({
  createOpenDentalPatientFromCrm: vi.fn(),
}))

vi.mock('@/lib/integrations/opendental/scheduling', () => ({
  bookOpenDentalAppointment: vi.fn(),
  getOpenDentalOpenSlotsForOperatories: vi.fn(),
}))

vi.mock('@/lib/practice-timezone', () => ({
  getPracticeTimeZone: vi.fn().mockResolvedValue('America/Chicago'),
}))

vi.mock('@/lib/patient-activity', () => ({
  logCustomActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/patient-identity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/patient-identity')>()
  return {
    ...actual,
    fetchOpenDentalChartFacts: vi.fn().mockResolvedValue(null),
    enrichPhoneCollisionsWithOdCharts: vi.fn().mockResolvedValue([]),
  }
})

const practiceId = '6a10eff8-e984-40ab-984b-57880defe60a'
const patientRow = {
  id: 'patient-1',
  name: 'Amin Thobani',
  firstName: 'Amin',
  lastName: 'Thobani',
  dateOfBirth: new Date('1964-12-13T00:00:00.000Z'),
  phone: '6309652880',
  primaryPhone: '6309652880',
  externalEhrId: null as string | null,
  email: null,
}

const odScheduling = {
  mode: 'open_dental' as const,
  defaultProvNum: 24,
  defaultOperatoryNum: 2,
  defaultOperatoryNums: [5],
  defaultLengthMinutes: 30,
}

describe('agentActions Open Dental scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSchedulingSettings).mockResolvedValue(odScheduling)
    vi.mocked(bookOpenDentalAppointment).mockReset()
    vi.mocked(createOpenDentalPatientFromCrm).mockReset()
  })

  describe('findOrCreatePatientByPhone', () => {
    it('auto-links an existing unlinked patient when OD scheduling is enabled', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([patientRow] as never)
      vi.mocked(createOpenDentalPatientFromCrm).mockResolvedValue({
        status: 'success',
        patNum: 2275,
        externalEhrId: 'opendental:2275',
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({
        ...patientRow,
        externalEhrId: 'opendental:2275',
      } as never)

      const { findOrCreatePatientByPhone } = await import('@/lib/agentActions')
      const result = await findOrCreatePatientByPhone(practiceId, '+16309652880', {
        name: 'Amin Thobani',
        dateOfBirth: '1964-12-13',
      })

      expect(createOpenDentalPatientFromCrm).toHaveBeenCalledWith({
        practiceId,
        patientId: 'patient-1',
      })
      expect(result.patientId).toBe('patient-1')
      expect(result.facts.crm_chart?.external_ehr_id).toBe('opendental:2275')
    })

    it('auto-creates a new patient when caller first+last differ from the phone match', async () => {
      const amirOnFile = {
        id: 'c3463ef0-99dd-4e5b-91d3-086c2fc35281',
        name: 'Amin Thobani',
        firstName: 'Amir',
        lastName: 'Thobani',
        dateOfBirth: new Date('1965-12-13T00:00:00.000Z'),
        phone: '16309652880',
        primaryPhone: '(630)965-2880',
        externalEhrId: 'opendental:2274',
        email: null,
      }
      const created = {
        id: 'new-amin',
        name: 'Amin Thobani',
        firstName: 'Amin',
        lastName: 'Thobani',
        dateOfBirth: new Date('1966-12-26T00:00:00.000Z'),
        phone: '16309652880',
        primaryPhone: '16309652880',
        externalEhrId: null as string | null,
        email: null,
      }

      vi.mocked(prisma.patient.findMany).mockResolvedValue([amirOnFile] as never)
      vi.mocked(prisma.patient.create).mockResolvedValue(created as never)
      vi.mocked(createOpenDentalPatientFromCrm).mockResolvedValue({
        status: 'success',
        patNum: 9999,
        externalEhrId: 'opendental:9999',
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({
        ...created,
        externalEhrId: 'opendental:9999',
      } as never)

      const { findOrCreatePatientByPhone } = await import('@/lib/agentActions')
      const result = await findOrCreatePatientByPhone(practiceId, '+16309652880', {
        name: 'Amin Thobani',
        dateOfBirth: '1966-12-26',
      })

      expect(prisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Amin Thobani',
            firstName: 'Amin',
            lastName: 'Thobani',
            phone: '16309652880',
          }),
        })
      )
      expect(result.patientId).toBe('new-amin')
      expect(result.isNew).toBe(true)
      expect(result.requires_agent_decision).toBe(false)
      expect(result.facts.recommendation).toBe('create_new')
    })

    it('reuses the existing patient when first+last and DOB match', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([patientRow] as never)
      vi.mocked(createOpenDentalPatientFromCrm).mockResolvedValue({
        status: 'success',
        patNum: 2275,
        externalEhrId: 'opendental:2275',
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({
        ...patientRow,
        externalEhrId: 'opendental:2275',
      } as never)

      const { findOrCreatePatientByPhone } = await import('@/lib/agentActions')
      const result = await findOrCreatePatientByPhone(practiceId, '+16309652880', {
        name: 'Amin Thobani',
        dateOfBirth: '1964-12-13',
      })

      expect(prisma.patient.create).not.toHaveBeenCalled()
      expect(result.patientId).toBe('patient-1')
      expect(result.isNew).toBe(false)
    })
  })

  describe('bookAppointment', () => {
    it('throws when patient cannot be linked to Open Dental', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(patientRow as never)
      vi.mocked(createOpenDentalPatientFromCrm).mockResolvedValue({
        status: 'error',
        reason: 'opendental_not_configured',
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(patientRow as never)

      const { bookAppointment } = await import('@/lib/agentActions')

      await expect(
        bookAppointment(
          practiceId,
          'patient-1',
          'ignored',
          '2026-07-03T19:00:00.000Z',
          'America/Chicago'
        )
      ).rejects.toThrow(/Could not link patient to Open Dental/)

      expect(bookOpenDentalAppointment).not.toHaveBeenCalled()
    })

    it('links patient to Open Dental before booking when externalEhrId is missing', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({
        ...patientRow,
        createdAt: new Date(),
      } as never)

      vi.mocked(createOpenDentalPatientFromCrm).mockResolvedValue({
        status: 'success',
        patNum: 2275,
        externalEhrId: 'opendental:2275',
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({
        ...patientRow,
        externalEhrId: 'opendental:2275',
        createdAt: new Date(),
      } as never)
      vi.mocked(bookOpenDentalAppointment).mockResolvedValue({
        appointmentId: 'appt-1',
        aptNum: 100,
        startTime: new Date('2026-07-03T19:00:00.000Z'),
        endTime: new Date('2026-07-03T19:30:00.000Z'),
      })

      const { bookAppointment } = await import('@/lib/agentActions')
      const result = await bookAppointment(
        practiceId,
        'patient-1',
        'ignored',
        '2026-07-03T19:00:00.000Z',
        'America/Chicago',
        'check-up'
      )

      expect(createOpenDentalPatientFromCrm).toHaveBeenCalled()
      expect(bookOpenDentalAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          practiceId,
          patientId: 'patient-1',
          opNum: 2,
          isNewPatient: true,
        })
      )
      expect(result.calBookingId).toBe('opendental:apt:100')
    })
  })

  describe('getAvailableSlots', () => {
    it('queries all resolved read operatories in Open Dental mode', async () => {
      const { getOpenDentalOpenSlotsForOperatories } = await import(
        '@/lib/integrations/opendental/scheduling'
      )
      vi.mocked(getSchedulingSettings).mockResolvedValue({
        mode: 'open_dental',
        defaultReadOperatoryNum: 1,
        defaultReadOperatoryNums: [3],
        defaultOperatoryNum: 2,
        defaultLengthMinutes: 30,
      })
      vi.mocked(getOpenDentalOpenSlotsForOperatories).mockResolvedValue([
        {
          start: '2026-07-03 14:00:00',
          startUtc: '2026-07-03T19:00:00.000Z',
          provNum: 24,
          opNum: 1,
          lengthMinutes: 30,
        },
      ])

      const { getAvailableSlots } = await import('@/lib/agentActions')
      const slots = await getAvailableSlots(
        practiceId,
        'event-type',
        '2026-07-01',
        '2026-07-14',
        'America/Chicago'
      )

      expect(getOpenDentalOpenSlotsForOperatories).toHaveBeenCalledWith(
        expect.objectContaining({
          practiceId,
          opNums: [1, 3],
        })
      )
      expect(slots).toHaveLength(1)
      expect(slots[0].time).toBe('2026-07-03T19:00:00.000Z')
      expect(slots[0].attendeeCount).toBe(0)
      expect(slots[0].timezone).toBe('America/Chicago')
      expect(slots[0].time_local).toMatch(/Friday, July 3 at 2:00/)
    })
  })
})
