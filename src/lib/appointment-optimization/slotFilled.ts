import { prisma } from '@/lib/db'
import { OPEN_SLOT_STATUS } from '@/lib/appointment-optimization/types'
import { slotOverlapsCalendarBlock } from '@/lib/calendar/blockingIntervals'

/**
 * Returns true when a scheduled/confirmed appointment or Vantage calendar block
 * occupies this slot window.
 * Uses live data — not the openSlotEvent.status flag — so a slot marked
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

  if (overlapping) return true

  return slotOverlapsCalendarBlock({
    practiceId: slot.practiceId,
    slotStart: slot.slotStart,
    slotEnd: slot.slotEnd,
    providerId: slot.providerId,
  })
}

/** True while the slot time is still in the future and no appointment occupies it. */
export async function isSlotOpenForReplies(openSlotEventId: string): Promise<boolean> {
  const slot = await prisma.openSlotEvent.findUnique({
    where: { id: openSlotEventId },
    select: { slotStart: true },
  })
  if (!slot) return false
  if (slot.slotStart <= new Date()) return false
  return !(await isOpenSlotFilled(openSlotEventId))
}

/**
 * Align slot status with reality: filled when occupied, exhausted only after slot time passes unfilled.
 */
export async function syncOpenSlotLifecycle(openSlotEventId: string): Promise<void> {
  const slot = await prisma.openSlotEvent.findUnique({
    where: { id: openSlotEventId },
  })
  if (!slot) return

  if (await isOpenSlotFilled(openSlotEventId)) {
    if (slot.status !== OPEN_SLOT_STATUS.FILLED) {
      await markOpenSlotFilled(openSlotEventId)
    }
    return
  }

  if (
    slot.slotStart <= new Date() &&
    (slot.status === OPEN_SLOT_STATUS.OPEN || slot.status === OPEN_SLOT_STATUS.EXHAUSTED)
  ) {
    await markOpenSlotExhausted(openSlotEventId)
    return
  }

  if (
    slot.status === OPEN_SLOT_STATUS.FILLED ||
    slot.status === OPEN_SLOT_STATUS.EXHAUSTED
  ) {
    await prisma.openSlotEvent.update({
      where: { id: openSlotEventId },
      data: { status: OPEN_SLOT_STATUS.OPEN, filledAt: null },
    })
  }
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
