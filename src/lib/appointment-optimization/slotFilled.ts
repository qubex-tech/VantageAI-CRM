import { prisma } from '@/lib/db'
import { OPEN_SLOT_STATUS } from '@/lib/appointment-optimization/types'
import { slotOverlapsCalendarBlock } from '@/lib/calendar/blockingIntervals'
import { getSlotHoursViolationForPractice } from '@/lib/practice-hours/availability'

/**
 * Returns true when a scheduled/confirmed appointment, Vantage calendar block,
 * or practice hours/lunch restriction occupies this slot window.
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

  if (
    await slotOverlapsCalendarBlock({
      practiceId: slot.practiceId,
      slotStart: slot.slotStart,
      slotEnd: slot.slotEnd,
      providerId: slot.providerId,
    })
  ) {
    return true
  }

  const hoursViolation = await getSlotHoursViolationForPractice({
    practiceId: slot.practiceId,
    slotStart: slot.slotStart,
    slotEnd: slot.slotEnd,
  })
  return Boolean(hoursViolation)
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
 * Align slot status with reality:
 * - future + occupied → filled (someone took the opening while outreach was live)
 * - past → exhausted, unless it was already marked filled before the slot started
 *   (post-hoc calendar overlap after the slot time must not inflate Filled)
 * - future filled/exhausted that is free again → open
 */
export async function syncOpenSlotLifecycle(openSlotEventId: string): Promise<void> {
  const slot = await prisma.openSlotEvent.findUnique({
    where: { id: openSlotEventId },
  })
  if (!slot) return

  const occupied = await isOpenSlotFilled(openSlotEventId)
  const isPast = slot.slotStart <= new Date()

  if (isPast) {
    const filledBeforeSlotStart =
      slot.status === OPEN_SLOT_STATUS.FILLED &&
      slot.filledAt != null &&
      slot.filledAt.getTime() <= slot.slotStart.getTime()

    if (filledBeforeSlotStart) return

    if (slot.status !== OPEN_SLOT_STATUS.EXHAUSTED || slot.filledAt != null) {
      await markOpenSlotExhausted(openSlotEventId)
    }
    return
  }

  if (occupied) {
    if (slot.status !== OPEN_SLOT_STATUS.FILLED) {
      await markOpenSlotFilled(openSlotEventId)
    }
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
    data: { status: OPEN_SLOT_STATUS.EXHAUSTED, filledAt: null },
  })
}
