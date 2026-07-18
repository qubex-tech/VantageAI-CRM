import { prisma } from '@/lib/db'
import { syncOpenSlotLifecycle } from '@/lib/appointment-optimization/slotFilled'
import { OPEN_SLOT_STATUS } from '@/lib/appointment-optimization/types'

/**
 * Sync lifecycle for past slots still marked open/filled.
 * Past unfilled (including post-hoc "filled" from calendar overlap) → exhausted.
 * Keeps Active clean and Exhausted/Filled cards accurate.
 */
export async function reconcileStaleOpenSlotsForPractice(
  practiceId: string,
  options?: { limit?: number }
): Promise<{ checked: number }> {
  const limit = options?.limit ?? 50
  const now = new Date()

  const stale = await prisma.openSlotEvent.findMany({
    where: {
      practiceId,
      status: { in: [OPEN_SLOT_STATUS.OPEN, OPEN_SLOT_STATUS.FILLED] },
      slotStart: { lte: now },
    },
    select: { id: true },
    orderBy: { slotStart: 'asc' },
    take: limit,
  })

  for (const slot of stale) {
    await syncOpenSlotLifecycle(slot.id)
  }

  return { checked: stale.length }
}
