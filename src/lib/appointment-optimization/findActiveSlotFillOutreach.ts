import { prisma } from '@/lib/db'
import { OPEN_SLOT_STATUS } from '@/lib/appointment-optimization/types'
import { patientMatchesReplyPhone } from '@/lib/patient-phone-match'

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

function pickActiveSlotFillAttempt(
  attempts: OutreachAttemptWithContext[]
): OutreachAttemptWithContext | null {
  for (const attempt of attempts) {
    const slot = attempt.openSlotEvent
    if (!slot || slot.status !== OPEN_SLOT_STATUS.OPEN) continue
    if (slot.slotStart <= new Date()) continue
    if (!attempt.appointmentId || !attempt.appointment) continue
    if (!['scheduled', 'confirmed'].includes(attempt.appointment.status)) continue
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
