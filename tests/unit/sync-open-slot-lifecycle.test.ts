import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
const update = vi.fn()
const appointmentFindFirst = vi.fn()
const slotOverlapsCalendarBlock = vi.fn()
const getSlotHoursViolationForPractice = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    openSlotEvent: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
    },
    appointment: {
      findFirst: (...args: unknown[]) => appointmentFindFirst(...args),
    },
  },
}))

vi.mock('@/lib/calendar/blockingIntervals', () => ({
  slotOverlapsCalendarBlock: (...args: unknown[]) => slotOverlapsCalendarBlock(...args),
}))

vi.mock('@/lib/practice-hours/availability', () => ({
  getSlotHoursViolationForPractice: (...args: unknown[]) =>
    getSlotHoursViolationForPractice(...args),
}))

describe('syncOpenSlotLifecycle', () => {
  beforeEach(() => {
    findUnique.mockReset()
    update.mockReset()
    appointmentFindFirst.mockReset()
    slotOverlapsCalendarBlock.mockReset()
    getSlotHoursViolationForPractice.mockReset()
    appointmentFindFirst.mockResolvedValue(null)
    slotOverlapsCalendarBlock.mockResolvedValue(false)
    getSlotHoursViolationForPractice.mockResolvedValue(null)
  })

  it('exhausts past open slots that are unfilled', async () => {
    const past = new Date(Date.now() - 60_000)
    findUnique.mockResolvedValue({
      id: 'slot-1',
      practiceId: 'p1',
      providerId: null,
      status: 'open',
      filledAt: null,
      slotStart: past,
      slotEnd: new Date(past.getTime() + 30 * 60_000),
    })
    update.mockResolvedValue({})

    const { syncOpenSlotLifecycle } = await import(
      '@/lib/appointment-optimization/slotFilled'
    )
    await syncOpenSlotLifecycle('slot-1')

    expect(update).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
      data: { status: 'exhausted', filledAt: null },
    })
  })

  it('exhausts past slots marked filled only after the slot started', async () => {
    const past = new Date(Date.now() - 60_000)
    findUnique.mockResolvedValue({
      id: 'slot-2',
      practiceId: 'p1',
      providerId: null,
      status: 'filled',
      filledAt: new Date(), // post-hoc occupancy sync
      slotStart: past,
      slotEnd: new Date(past.getTime() + 30 * 60_000),
    })
    appointmentFindFirst.mockResolvedValue({ id: 'appt-1' })
    update.mockResolvedValue({})

    const { syncOpenSlotLifecycle } = await import(
      '@/lib/appointment-optimization/slotFilled'
    )
    await syncOpenSlotLifecycle('slot-2')

    expect(update).toHaveBeenCalledWith({
      where: { id: 'slot-2' },
      data: { status: 'exhausted', filledAt: null },
    })
  })

  it('keeps past slots that were filled before the slot started', async () => {
    const past = new Date(Date.now() - 60_000)
    const filledAt = new Date(past.getTime() - 60_000)
    findUnique.mockResolvedValue({
      id: 'slot-3',
      practiceId: 'p1',
      providerId: null,
      status: 'filled',
      filledAt,
      slotStart: past,
      slotEnd: new Date(past.getTime() + 30 * 60_000),
    })
    update.mockResolvedValue({})

    const { syncOpenSlotLifecycle } = await import(
      '@/lib/appointment-optimization/slotFilled'
    )
    await syncOpenSlotLifecycle('slot-3')

    expect(update).not.toHaveBeenCalled()
  })
})
