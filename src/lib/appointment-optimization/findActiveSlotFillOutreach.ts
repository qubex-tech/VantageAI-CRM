import { prisma } from '@/lib/db'
import { OPEN_SLOT_STATUS } from '@/lib/appointment-optimization/types'

const REPLY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

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
    include: {
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
    },
  })

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
