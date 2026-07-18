import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
const syncOpenSlotLifecycle = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    openSlotEvent: {
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}))

vi.mock('@/lib/appointment-optimization/slotFilled', () => ({
  syncOpenSlotLifecycle: (...args: unknown[]) => syncOpenSlotLifecycle(...args),
}))

describe('reconcileStaleOpenSlotsForPractice', () => {
  beforeEach(() => {
    findMany.mockReset()
    syncOpenSlotLifecycle.mockReset()
  })

  it('syncs each past open slot', async () => {
    findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    syncOpenSlotLifecycle.mockResolvedValue(undefined)

    const { reconcileStaleOpenSlotsForPractice } = await import(
      '@/lib/appointment-optimization/reconcileOpenSlots'
    )
    const result = await reconcileStaleOpenSlotsForPractice('practice-1')

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          practiceId: 'practice-1',
          status: 'open',
          slotStart: expect.objectContaining({ lte: expect.any(Date) }),
        }),
      })
    )
    expect(syncOpenSlotLifecycle).toHaveBeenCalledTimes(2)
    expect(syncOpenSlotLifecycle).toHaveBeenNthCalledWith(1, 'a')
    expect(syncOpenSlotLifecycle).toHaveBeenNthCalledWith(2, 'b')
    expect(result).toEqual({ checked: 2 })
  })
})
