import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    patient: {
      findFirst: vi.fn(),
    },
    appointment: {
      upsert: vi.fn(),
    },
  },
}))

vi.mock('@/lib/integrations/opendental/factory', () => ({
  getOpenDentalServices: vi.fn(),
}))

vi.mock('@/lib/practice-timezone', () => ({
  getPracticeTimeZone: vi.fn().mockResolvedValue('America/Chicago'),
}))

vi.mock('@/lib/integrations/opendental/audit', () => ({
  logOpenDentalAudit: vi.fn().mockResolvedValue(undefined),
}))

describe('bookOpenDentalAppointment IsNewPatient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends IsNewPatient=true when booking a new patient', async () => {
    const { prisma } = await import('@/lib/db')
    const { getOpenDentalServices } = await import('@/lib/integrations/opendental/factory')
    const create = vi.fn().mockResolvedValue({ AptNum: 100 })

    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'patient-1',
      externalEhrId: 'opendental:99',
    } as never)
    vi.mocked(prisma.appointment.upsert).mockResolvedValue({ id: 'appt-1' } as never)
    vi.mocked(getOpenDentalServices).mockResolvedValue({
      appointments: { create },
    } as never)

    const { bookOpenDentalAppointment } = await import(
      '@/lib/integrations/opendental/scheduling'
    )
    await bookOpenDentalAppointment({
      practiceId: 'practice-1',
      patientId: 'patient-1',
      opNum: 2,
      dateTimeStart: '2026-07-20 14:30:00',
      note: 'new patient exam',
      isNewPatient: true,
    })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        PatNum: 99,
        Op: 2,
        IsNewPatient: 'true',
        Note: 'new patient exam',
      })
    )
  })

  it('omits IsNewPatient for existing patients', async () => {
    const { prisma } = await import('@/lib/db')
    const { getOpenDentalServices } = await import('@/lib/integrations/opendental/factory')
    const create = vi.fn().mockResolvedValue({ AptNum: 101 })

    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'patient-2',
      externalEhrId: 'opendental:88',
    } as never)
    vi.mocked(prisma.appointment.upsert).mockResolvedValue({ id: 'appt-2' } as never)
    vi.mocked(getOpenDentalServices).mockResolvedValue({
      appointments: { create },
    } as never)

    const { bookOpenDentalAppointment } = await import(
      '@/lib/integrations/opendental/scheduling'
    )
    await bookOpenDentalAppointment({
      practiceId: 'practice-1',
      patientId: 'patient-2',
      opNum: 2,
      dateTimeStart: '2026-07-20 14:30:00',
      note: 'tooth pain',
      isNewPatient: false,
    })

    const body = create.mock.calls[0][0] as Record<string, unknown>
    expect(body.IsNewPatient).toBeUndefined()
  })
})
