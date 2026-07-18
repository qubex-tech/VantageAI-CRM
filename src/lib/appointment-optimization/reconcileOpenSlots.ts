import { prisma } from '@/lib/db'
import { syncOpenSlotLifecycle } from '@/lib/appointment-optimization/slotFilled'
import { OPEN_SLOT_STATUS } from '@/lib/appointment-optimization/types'

/**
 * Sync lifecycle for open slots whose start time has passed (and optionally
 * a few still-open future slots). Past unfilled → exhausted; occupied → filled.
 * Keeps the Active dashboard from retaining stale `open` rows.
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
      status: OPEN_SLOT_STATUS.OPEN,
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
