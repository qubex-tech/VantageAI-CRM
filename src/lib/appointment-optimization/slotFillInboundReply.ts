import { prisma } from '@/lib/db'
import { getSmsClient } from '@/lib/sms'
import {
  acceptEarlierSlotOffer,
  type AcceptEarlierSlotResult,
} from '@/lib/appointment-optimization/acceptEarlierSlot'
import {
  classifySlotFillReply,
  type SlotFillReplyContext,
} from '@/lib/appointment-optimization/classifySlotFillReply'
import { findActiveSlotFillOutreach } from '@/lib/appointment-optimization/findActiveSlotFillOutreach'
import { formatSlotDateTime } from '@/lib/appointment-optimization/formatSlotTimes'
import {
  getOutboundAgentsSettings,
  isAppointmentOptimizationEnabled,
} from '@/lib/appointment-optimization/settings'
import { getPracticeTimeZone } from '@/lib/practice-timezone'

export type SlotFillInboundReplyResult = {
  handled: boolean
  action?: 'booked' | 'declined' | 'ignored' | 'failed'
  reason?: string
  booking?: AcceptEarlierSlotResult
}

export async function handleSlotFillInboundSms(params: {
  practiceId: string
  patientId: string
  body: string
}): Promise<SlotFillInboundReplyResult> {
  const settings = await getOutboundAgentsSettings(params.practiceId)
  if (!isAppointmentOptimizationEnabled(settings)) {
    return { handled: false, reason: 'agent_disabled' }
  }
  if (settings.smsReplyHandling === 'practice_number') {
    return { handled: false, reason: 'practice_number_no_inbound' }
  }

  const attempt = await findActiveSlotFillOutreach({
    practiceId: params.practiceId,
    patientId: params.patientId,
  })
  if (!attempt?.openSlotEvent || !attempt.appointment) {
    return { handled: false, reason: 'no_active_offer' }
  }

  const timeZone = await getPracticeTimeZone(params.practiceId)
  const context: SlotFillReplyContext = {
    offeredSlotDescription: formatSlotDateTime(attempt.openSlotEvent.slotStart, timeZone),
    currentAppointmentDescription: formatSlotDateTime(attempt.appointment.startTime, timeZone),
  }

  const classification = await classifySlotFillReply(params.body, context)

  if (classification.intent === 'decline') {
    await prisma.outreachAttempt.update({
      where: { id: attempt.id },
      data: { status: 'declined' },
    })
    return { handled: true, action: 'declined' }
  }

  if (
    classification.intent !== 'accept_earlier_slot' ||
    (classification.confidence === 'low' && classification.method !== 'keyword')
  ) {
    return { handled: true, action: 'ignored', reason: classification.intent }
  }

  const booking = await acceptEarlierSlotOffer({ outreachAttemptId: attempt.id })

  if (booking.status === 'booked') {
    await sendConfirmationSms({
      practiceId: params.practiceId,
      phone:
        attempt.patient.primaryPhone ||
        attempt.patient.phone ||
        attempt.patient.secondaryPhone ||
        '',
      slotStart: attempt.openSlotEvent.slotStart,
      timeZone,
    })
    return { handled: true, action: 'booked', booking }
  }

  if (booking.status === 'skipped' && booking.reason === 'slot_not_open') {
    await sendConfirmationSms({
      practiceId: params.practiceId,
      phone:
        attempt.patient.primaryPhone ||
        attempt.patient.phone ||
        attempt.patient.secondaryPhone ||
        '',
      slotStart: attempt.openSlotEvent.slotStart,
      timeZone,
      body: 'Thanks for your reply — that earlier appointment slot was just filled. We will reach out if another opens.',
    })
    return { handled: true, action: 'failed', reason: booking.reason, booking }
  }

  return { handled: true, action: 'failed', reason: booking.reason, booking }
}

async function sendConfirmationSms(params: {
  practiceId: string
  phone: string
  slotStart: Date
  timeZone: string
  body?: string
}) {
  if (!params.phone.trim()) return
  const message =
    params.body ??
    `You're confirmed for ${formatSlotDateTime(params.slotStart, params.timeZone)}. Reply STOP to opt out.`
  try {
    const sms = await getSmsClient(params.practiceId)
    await sms.sendSms({ to: params.phone, body: message })
  } catch (error) {
    console.warn('[SlotFill] confirmation SMS failed', error)
  }
}
