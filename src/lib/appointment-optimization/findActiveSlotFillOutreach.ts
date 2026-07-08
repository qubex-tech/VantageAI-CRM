import { prisma } from '@/lib/db'
import { patientMatchesReplyPhone } from '@/lib/patient-phone-match'
import { isSlotOpenForReplies } from '@/lib/appointment-optimization/slotFilled'

const REPLY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

const outreachAttemptInclude = {
  openSlotEvent: true,
  appointment: {
    select: {
      id: true,
      startTime: true,
      endTime: true,
      visitType: true,
      status: true,
      calBookingId: true,
      providerId: true,
      timezone: true,
    },
  },
  patient: {
    select: {
      id: true,
      name: true,
      firstName: true,
      preferredName: true,
      email: true,
      phone: true,
      primaryPhone: true,
      secondaryPhone: true,
      externalEhrId: true,
    },
  },
} as const

type OutreachAttemptWithContext = Awaited<
  ReturnType<typeof prisma.outreachAttempt.findMany<{ include: typeof outreachAttemptInclude }>>
>[number]

export function canAcceptSlotFillReply(params: {
  slotStart: Date
  slotUnfilled: boolean
  appointmentId: string | null
  appointmentStatus: string | null | undefined
}): boolean {
  if (params.slotStart <= new Date()) return false
  if (!params.slotUnfilled) return false
  if (!params.appointmentId) return false
  if (!params.appointmentStatus) return false
  return ['scheduled', 'confirmed'].includes(params.appointmentStatus)
}

async function pickActiveSlotFillAttempt(
  attempts: OutreachAttemptWithContext[]
): Promise<OutreachAttemptWithContext | null> {
  const slotUnfilledCache = new Map<string, boolean>()

  for (const attempt of attempts) {
    const slot = attempt.openSlotEvent
    if (!slot) continue

    let slotUnfilled = slotUnfilledCache.get(slot.id)
    if (slotUnfilled === undefined) {
      slotUnfilled = await isSlotOpenForReplies(slot.id)
      slotUnfilledCache.set(slot.id, slotUnfilled)
    }

    if (
      !canAcceptSlotFillReply({
        slotStart: slot.slotStart,
        slotUnfilled,
        appointmentId: attempt.appointmentId,
        appointmentStatus: attempt.appointment?.status,
      })
    ) {
      continue
    }

    return attempt
  }

  return null
}

/**
 * Most recent slot-fill SMS outreach to this patient where the open slot is still available.
 */
export async function findActiveSlotFillOutreach(params: {
  practiceId: string
  patientId: string
}) {
  const since = new Date(Date.now() - REPLY_WINDOW_MS)

  const attempts = await prisma.outreachAttempt.findMany({
    where: {
      practiceId: params.practiceId,
      patientId: params.patientId,
      channel: 'sms',
      status: { in: ['sent', 'delivered'] },
      sentAt: { gte: since },
    },
    orderBy: { sentAt: 'desc' },
    take: 5,
    include: outreachAttemptInclude,
  })

  return pickActiveSlotFillAttempt(attempts)
}

/**
 * Resolve an active slot-fill offer from an inbound reply number.
 * Uses the outreach record's patientId (who we texted), not demographic guessing.
 */
export async function findActiveSlotFillOutreachByReplyPhone(params: {
  practiceIds: string[]
  replyFrom: string
}) {
  if (params.practiceIds.length === 0) return null

  const since = new Date(Date.now() - REPLY_WINDOW_MS)

  const attempts = await prisma.outreachAttempt.findMany({
    where: {
      practiceId: { in: params.practiceIds },
      channel: 'sms',
      status: { in: ['sent', 'delivered'] },
      sentAt: { gte: since },
    },
    orderBy: { sentAt: 'desc' },
    take: 25,
    include: outreachAttemptInclude,
  })

  const phoneMatched = attempts.filter((attempt) =>
    patientMatchesReplyPhone(attempt.patient, params.replyFrom)
  )

  return pickActiveSlotFillAttempt(phoneMatched)
}
