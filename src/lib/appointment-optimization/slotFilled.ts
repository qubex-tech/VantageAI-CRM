import { prisma } from '@/lib/db'
import { OPEN_SLOT_STATUS } from '@/lib/appointment-optimization/types'

/**
 * Returns true when a scheduled/confirmed appointment occupies this slot window.
 * Uses live appointment data — not the openSlotEvent.status flag — so a slot marked
 * `filled` can become available again after that appointment is cancelled.
 */
export async function isOpenSlotFilled(openSlotEventId: string): Promise<boolean> {
  const slot = await prisma.openSlotEvent.findUnique({
    where: { id: openSlotEventId },
  })
  if (!slot) return false

  const overlapping = await prisma.appointment.findFirst({
    where: {
      practiceId: slot.practiceId,
      status: { in: ['scheduled', 'confirmed'] },
      ...(slot.providerId ? { providerId: slot.providerId } : {}),
      startTime: { lt: slot.slotEnd },
      endTime: { gt: slot.slotStart },
    },
    select: { id: true },
  })

  return Boolean(overlapping)
}

export async function markOpenSlotFilled(openSlotEventId: string) {
  return prisma.openSlotEvent.update({
    where: { id: openSlotEventId },
    data: {
      status: OPEN_SLOT_STATUS.FILLED,
      filledAt: new Date(),
    },
  })
}

export async function markOpenSlotExhausted(openSlotEventId: string) {
  return prisma.openSlotEvent.update({
    where: { id: openSlotEventId },
    data: { status: OPEN_SLOT_STATUS.EXHAUSTED },
  })
}
