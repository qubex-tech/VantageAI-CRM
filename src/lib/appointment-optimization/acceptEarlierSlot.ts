import { prisma } from '@/lib/db'
import { getCalClient } from '@/lib/cal'
import { canonicalCalBookingId } from '@/lib/cal-booking-id'
import { cancelAppointmentInCal, cancelSupersededCalBookings } from '@/lib/integrations/cal/appointmentWriteback'
import { writeBackAppointmentToOpenDental } from '@/lib/integrations/opendental/appointmentWriteback'
import {
  getSchedulingSettings,
} from '@/lib/integrations/clinical-system/server'
import {
  canBookAppointments,
  usesOpenDentalForWrite,
} from '@/lib/integrations/clinical-system/types'
import { handleAppointmentChangeForSlotFill } from '@/lib/appointment-optimization/appointmentChangeHandler'
import { formatSlotDateTime } from '@/lib/appointment-optimization/formatSlotTimes'
import { markOpenSlotFilled } from '@/lib/appointment-optimization/slotFilled'
import { getPracticeTimeZone } from '@/lib/practice-timezone'

export type AcceptEarlierSlotResult =
  | { status: 'booked'; appointmentId: string; openSlotEventId: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

/**
 * Move the patient's existing later appointment into the offered open slot.
 * Supports CRM-only, Open Dental writeback, and Cal.com (cancel + rebook).
 */
export async function acceptEarlierSlotOffer(params: {
  outreachAttemptId: string
}): Promise<AcceptEarlierSlotResult> {
  const attempt = await prisma.outreachAttempt.findUnique({
    where: { id: params.outreachAttemptId },
    include: {
      openSlotEvent: true,
      appointment: true,
      patient: true,
    },
  })

  if (!attempt?.openSlotEvent || !attempt.appointment || !attempt.patient) {
    return { status: 'skipped', reason: 'missing_context' }
  }

  const slot = attempt.openSlotEvent
  const appointment = attempt.appointment
  const { practiceId } = attempt

  if (slot.status !== 'open') {
    return { status: 'skipped', reason: 'slot_not_open' }
  }
  if (slot.slotStart <= new Date()) {
    return { status: 'skipped', reason: 'slot_in_past' }
  }
  if (!['scheduled', 'confirmed'].includes(appointment.status)) {
    return { status: 'skipped', reason: 'appointment_not_active' }
  }
  if (appointment.startTime <= slot.slotStart) {
    return { status: 'skipped', reason: 'appointment_not_later_than_slot' }
  }

  const durationMs = appointment.endTime.getTime() - appointment.startTime.getTime()
  const newEnd = new Date(slot.slotEnd.getTime())
  if (Math.abs(newEnd.getTime() - slot.slotStart.getTime() - durationMs) > 60_000) {
    // Prefer slot end from open event; fall back to preserved duration
    const preservedEnd = new Date(slot.slotStart.getTime() + durationMs)
    newEnd.setTime(preservedEnd.getTime())
  }

  const before = {
    id: appointment.id,
    practiceId: appointment.practiceId,
    providerId: appointment.providerId,
    visitType: appointment.visitType,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    timezone: appointment.timezone,
    status: appointment.status,
  }

  const originalCalBookingId = appointment.calBookingId
  const originalStartTime = appointment.startTime

  let externalSync: Awaited<ReturnType<typeof syncExternalReschedule>>
  try {
    externalSync = await syncExternalReschedule({
      practiceId,
      appointment,
      patient: attempt.patient,
      newStart: slot.slotStart,
      newEnd,
    })
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'external_booking_failed',
    }
  }

  if (externalSync.mode === 'crm_fallback') {
    console.warn('[acceptEarlierSlot] Proceeding with CRM-only reschedule after Cal.com sync issue', {
      appointmentId: appointment.id,
      warning: externalSync.warning,
    })
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      startTime: slot.slotStart,
      endTime: newEnd,
      status: 'confirmed',
    },
  })

  await handleAppointmentChangeForSlotFill({ before, after: updated })

  await writeBackAcceptedSlotToOpenDental({
    practiceId,
    appointmentId: appointment.id,
  })

  await markOpenSlotFilled(slot.id)

  await cancelSupersededCalBookings({
    practiceId,
    originalCalBookingId,
    originalStartTime,
    patientEmail: attempt.patient.email,
    preserveCalBookingId: externalSync.newCalBookingId ?? null,
  })

  await prisma.outreachAttempt.update({
    where: { id: attempt.id },
    data: { status: 'accepted' },
  })

  const timeZone = await getPracticeTimeZone(practiceId)
  const { logAppointmentActivity } = await import('@/lib/patient-activity')
  await logAppointmentActivity({
    patientId: attempt.patientId,
    appointmentId: appointment.id,
    action: 'updated',
    title: 'Moved to earlier appointment',
    description: `Rescheduled via SMS offer to ${formatSlotDateTime(slot.slotStart, timeZone)}`,
    metadata: { openSlotEventId: slot.id, outreachAttemptId: attempt.id },
  })

  return {
    status: 'booked',
    appointmentId: appointment.id,
    openSlotEventId: slot.id,
  }
}

async function syncExternalReschedule(params: {
  practiceId: string
  appointment: {
    id: string
    visitType: string
    calBookingId: string | null
    startTime: Date
    endTime: Date
    timezone: string
    providerId: string | null
    status: string
    practiceId: string
    patientId: string
  }
  patient: {
    id: string
    email: string | null
    name: string
    phone: string | null
    primaryPhone: string | null
  }
  newStart: Date
  newEnd: Date
}): Promise<{
  mode: 'none' | 'cal' | 'crm_fallback'
  warning?: string
  newCalBookingId?: string
}> {
  const scheduling = await getSchedulingSettings(params.practiceId)
  const isOdLinked = params.appointment.calBookingId?.startsWith('opendental:')
  const isCalLinked =
    params.appointment.calBookingId &&
    !isOdLinked &&
    !params.appointment.calBookingId.startsWith('opendental:')

  if (usesOpenDentalForWrite(scheduling) || isOdLinked) {
    return { mode: 'none' }
  }

  if (isCalLinked && params.appointment.calBookingId) {
    if (!canBookAppointments(scheduling)) {
      throw new Error('Cal.com booking is not enabled for this practice')
    }

    const mapping = await prisma.calEventTypeMapping.findFirst({
      where: {
        practiceId: params.practiceId,
        visitTypeName: params.appointment.visitType,
      },
    })
    if (!mapping) {
      throw new Error(`No Cal.com event type mapped for visit type "${params.appointment.visitType}"`)
    }

    const calClient = await getCalClient(params.practiceId)
    const cancelResult = await cancelAppointmentInCal({
      practiceId: params.practiceId,
      calBookingId: params.appointment.calBookingId,
    })
    if (cancelResult.status === 'error') {
      throw new Error(cancelResult.reason || 'cal_cancel_failed')
    }

    const email = params.patient.email?.trim()
    if (!email) {
      throw new Error('Patient email is required for Cal.com booking')
    }

    try {
      const calBooking = await calClient.createBooking({
        eventTypeId: mapping.calEventTypeId,
        start: params.newStart.toISOString(),
        end: params.newEnd.toISOString(),
        timeZone: params.appointment.timezone,
        responses: {
          name: params.patient.name,
          email,
          phone: params.patient.primaryPhone || params.patient.phone || undefined,
          notes: 'Rescheduled via earlier appointment SMS offer',
        },
      })

      await prisma.appointment.update({
        where: { id: params.appointment.id },
        data: {
          calBookingId: canonicalCalBookingId(calBooking.uid, calBooking.id),
          calEventId: mapping.calEventTypeId,
        },
      })
      return {
        mode: 'cal',
        newCalBookingId: canonicalCalBookingId(calBooking.uid, calBooking.id) ?? undefined,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (shouldFallbackToCrmOnlyCalReschedule(message)) {
        return { mode: 'crm_fallback', warning: message }
      }
      throw error
    }
  }

  return { mode: 'none' }
}

function shouldFallbackToCrmOnlyCalReschedule(message: string): boolean {
  return (
    /already has booking at this time/i.test(message) ||
    /not available/i.test(message) ||
    /NotFoundException/i.test(message) ||
    message.includes('404')
  )
}

/** After local appointment times are updated, push to Open Dental if configured. */
export async function writeBackAcceptedSlotToOpenDental(params: {
  practiceId: string
  appointmentId: string
}) {
  const appt = await prisma.appointment.findFirst({
    where: { id: params.appointmentId, practiceId: params.practiceId },
    select: { calBookingId: true },
  })
  const isOdLinked = appt?.calBookingId?.startsWith('opendental:')
  const scheduling = await getSchedulingSettings(params.practiceId)
  if (!usesOpenDentalForWrite(scheduling) && !isOdLinked) return
  await writeBackAppointmentToOpenDental({
    practiceId: params.practiceId,
    appointmentId: params.appointmentId,
  })
}
