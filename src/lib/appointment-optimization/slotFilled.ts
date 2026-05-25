import { prisma } from '@/lib/db'
import { OPEN_SLOT_STATUS } from '@/lib/appointment-optimization/types'

/**
 * Returns true if the open slot window is now occupied by a scheduled/confirmed appointment.
 * Portal-driven booking updates the local appointments table via Cal/EHR sync.
 */
export async function isOpenSlotFilled(openSlotEventId: string): Promise<boolean> {
  const slot = await prisma.openSlotEvent.findUnique({
    where: { id: openSlotEventId },
  })
  if (!slot || slot.status !== OPEN_SLOT_STATUS.OPEN) {
    return slot?.status === OPEN_SLOT_STATUS.FILLED
  }

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
