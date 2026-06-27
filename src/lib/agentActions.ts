/**
 * Voice Agent Actions
 * 
 * These functions handle tool calls from RetellAI voice agents
 * They perform actions like finding/creating patients, getting slots, and booking appointments
 */

import { prisma } from './db'
import { getCalClient } from './cal'
import { createAuditLog, createTimelineEntry } from './audit'
import { redactPHI } from './phi'
import { getSchedulingSettings } from '@/lib/integrations/clinical-system/server'
import type { SchedulingSettings } from '@/lib/integrations/clinical-system/types'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import {
  getOpenDentalOpenSlots,
  bookOpenDentalAppointment,
} from '@/lib/integrations/opendental/scheduling'
import { formatOpenDentalLocalDateTime } from '@/lib/integrations/opendental/commlogWriteback'
import { buildAppointmentExternalId } from '@/lib/integrations/opendental/appointmentSync'
import { writeBackAppointmentToOpenDental } from '@/lib/integrations/opendental/appointmentWriteback'

/** Coerce a date or datetime string to a bare "yyyy-MM-dd" for Open Dental slot queries. */
function toDateOnly(value: string): string {
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = new Date(value)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return value
}

export interface FindOrCreatePatientResult {
  patientId: string
  isNew: boolean
  patient: {
    id: string
    name: string
    phone: string
  }
}

export interface AvailableSlot {
  time: string
  attendeeCount: number
}

export interface BookAppointmentResult {
  appointmentId: string
  calBookingId: string
  startTime: string
  endTime: string
  confirmationMessage: string
}

/**
 * Find or create a patient by phone number
 */
export async function findOrCreatePatientByPhone(
  practiceId: string,
  phone: string,
  details?: {
    name?: string
    dateOfBirth?: string
    email?: string
  }
): Promise<FindOrCreatePatientResult> {
  // Normalize phone number (remove non-digits) - ensure it's a string
  const normalizedPhone = String(phone).replace(/\D/g, '')
  
  // Try to find existing patient - use exact match on normalized phone
  // First try exact match on normalized phone (check both phone and primaryPhone)
  let patient = await prisma.patient.findFirst({
    where: {
      practiceId,
      OR: [
        { phone: normalizedPhone },
        { primaryPhone: normalizedPhone },
      ],
      deletedAt: null,
    },
  })

  // If no exact match, try matching with normalized versions of stored phones
  // This handles cases where phone numbers are stored with formatting
  if (!patient) {
    const allPatients = await prisma.patient.findMany({
      where: {
        practiceId,
        deletedAt: null,
      },
      select: {
        id: true,
        phone: true,
        primaryPhone: true,
      },
    })

    const matchedPatient = allPatients.find(p => {
      const phoneNormalized = p.phone ? String(p.phone).replace(/\D/g, '') : ''
      const primaryPhoneNormalized = p.primaryPhone ? String(p.primaryPhone).replace(/\D/g, '') : ''
      return phoneNormalized === normalizedPhone || primaryPhoneNormalized === normalizedPhone
    })
    if (matchedPatient) {
      // Reload full patient record
      patient = await prisma.patient.findUnique({
        where: { id: matchedPatient.id },
      })
    }
  }

  let isNew = false

  if (!patient) {
    // Create new patient
    if (!details?.name) {
      throw new Error('Patient name is required for new patients')
    }

    patient = await prisma.patient.create({
      data: {
        practiceId,
        name: details.name,
        phone: normalizedPhone,
        dateOfBirth: details.dateOfBirth ? new Date(details.dateOfBirth) : new Date('1900-01-01'),
        email: details.email || undefined,
        preferredContactMethod: 'phone',
      },
    })

    isNew = true

    // Create timeline entry using new activity logging system
    const { logCustomActivity } = await import('@/lib/patient-activity')
    await logCustomActivity({
      patientId: patient.id,
      type: 'note',
      title: 'Patient created via voice call',
      description: 'Patient was created during a phone conversation',
    })

    // Best-effort: create + link the patient in Open Dental so they can be
    // booked into the OD schedule later in the same call. No-ops when OD is off.
    try {
      const { createOpenDentalPatientFromCrm } = await import(
        '@/lib/integrations/opendental/patientWriteback'
      )
      const odResult = await createOpenDentalPatientFromCrm({
        practiceId,
        patientId: patient.id,
      })
      if (odResult.status === 'success' && odResult.externalEhrId) {
        const refreshed = await prisma.patient.findUnique({ where: { id: patient.id } })
        if (refreshed) patient = refreshed
      }
    } catch (error) {
      console.error('[OpenDental] Voice patient create writeback failed', error)
    }
  } else if (details) {
    // Update existing patient with provided details
    const updateData: any = {}
    if (details.name) updateData.name = details.name
    if (details.email) updateData.email = details.email
    if (details.dateOfBirth) updateData.dateOfBirth = new Date(details.dateOfBirth)

    if (Object.keys(updateData).length > 0) {
      patient = await prisma.patient.update({
        where: { id: patient.id },
        data: updateData,
      })
    }
  }

  return {
    patientId: patient.id,
    isNew,
    patient: {
      id: patient.id,
      name: patient.name,
      phone: patient.phone,
    },
  }
}

/**
 * Get available appointment slots
 */
export async function getAvailableSlots(
  practiceId: string,
  eventTypeId: string,
  dateFrom: string,
  dateTo: string,
  timezone: string = 'America/New_York'
): Promise<AvailableSlot[]> {
  // When the practice schedules in Open Dental, return OD open slots instead of Cal.com.
  const scheduling = await getSchedulingSettings(practiceId)
  if (scheduling.mode === 'open_dental') {
    try {
      const slots = await getOpenDentalOpenSlots({
        practiceId,
        provNum: scheduling.defaultProvNum ?? null,
        opNum: scheduling.defaultOperatoryNum ?? null,
        dateStart: toDateOnly(dateFrom),
        dateEnd: toDateOnly(dateTo),
        lengthMinutes: scheduling.defaultLengthMinutes ?? null,
      })
      return slots
        .filter((s) => s.startUtc)
        .map((s) => ({ time: s.startUtc as string, attendeeCount: 0 }))
    } catch (error) {
      console.error('Error fetching Open Dental slots:', error)
      throw new Error('Failed to fetch available appointment slots')
    }
  }

  const calClient = await getCalClient(practiceId)
  
  try {
    const slots = await calClient.getAvailableSlots(eventTypeId, dateFrom, dateTo, timezone)
    return slots.map(slot => ({
      time: slot.time,
      attendeeCount: slot.attendeeCount || 0,
    }))
  } catch (error) {
    console.error('Error fetching available slots:', error)
    throw new Error('Failed to fetch available appointment slots')
  }
}

/**
 * Book an appointment via Cal.com
 */
/**
 * Book directly into Open Dental for practices in EHR scheduling mode.
 * Creates the appointment in OD (source of truth) and mirrors it into the CRM.
 */
async function bookAppointmentViaOpenDental(params: {
  practiceId: string
  patientId: string
  startTime: string
  reason?: string
  scheduling: SchedulingSettings
}): Promise<BookAppointmentResult> {
  const { practiceId, patientId, startTime, reason, scheduling } = params

  const opNum = scheduling.defaultOperatoryNum ?? null
  if (!opNum) {
    throw new Error(
      'Open Dental scheduling is enabled but no default operatory is configured. Set a default operatory in Scheduling settings.'
    )
  }

  const startInstant = new Date(startTime)
  if (Number.isNaN(startInstant.getTime())) {
    throw new Error('Invalid appointment start time')
  }

  const timeZone = await getPracticeTimeZone(practiceId)
  const dateTimeStart = formatOpenDentalLocalDateTime(startInstant, timeZone)

  const result = await bookOpenDentalAppointment({
    practiceId,
    patientId,
    provNum: scheduling.defaultProvNum ?? null,
    opNum,
    dateTimeStart,
    lengthMinutes: scheduling.defaultLengthMinutes ?? null,
    note: reason ?? null,
  })

  return {
    appointmentId: result.appointmentId,
    calBookingId: buildAppointmentExternalId(result.aptNum),
    startTime: result.startTime.toISOString(),
    endTime: result.endTime.toISOString(),
    confirmationMessage: `Your appointment has been scheduled for ${result.startTime.toLocaleString('en-US', { timeZone })}.`,
  }
}

export async function bookAppointment(
  practiceId: string,
  patientId: string,
  eventTypeId: string,
  startTime: string, // ISO string
  timezone: string = 'America/New_York',
  reason?: string
): Promise<BookAppointmentResult> {
  // Get patient
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      practiceId,
      deletedAt: null,
    },
  })

  if (!patient) {
    throw new Error('Patient not found')
  }

  // Route booking to Open Dental when the practice schedules in its EHR.
  const scheduling = await getSchedulingSettings(practiceId)
  if (scheduling.mode === 'open_dental') {
    return bookAppointmentViaOpenDental({
      practiceId,
      patientId,
      startTime,
      reason,
      scheduling,
    })
  }

  // Get event type mapping to determine visit type
  const eventMapping = await prisma.calEventTypeMapping.findFirst({
    where: {
      practiceId,
      calEventTypeId: eventTypeId,
    },
  })

  if (!eventMapping) {
    throw new Error('Event type not mapped for this practice')
  }

  // Calculate end time (assume 30 min default, adjust based on event type if needed)
  const start = new Date(startTime)
  const end = new Date(start.getTime() + 30 * 60 * 1000) // 30 minutes

  // Validate patient has required email for Cal.com booking
  if (!patient.email || patient.email.trim() === '') {
    throw new Error('Patient email is required to book an appointment via Cal.com')
  }

  // Create Cal.com booking
  const calClient = await getCalClient(practiceId)
  const calBooking = await calClient.createBooking({
    eventTypeId,
    start: startTime,
    end: end.toISOString(),
    timeZone: timezone,
    responses: {
      name: patient.name,
      email: patient.email.trim(),
      phone: (patient.primaryPhone || patient.phone)?.trim() || undefined,
      notes: reason,
    },
  })

  // Create local appointment record
  const appointment = await prisma.appointment.create({
    data: {
      practiceId,
      patientId,
      startTime: start,
      endTime: end,
      timezone,
      visitType: eventMapping.visitTypeName,
      status: 'scheduled',
      reason: reason || undefined,
      calEventId: eventTypeId,
      calBookingId: calBooking.uid || String(calBooking.id),
    },
  })

  // Create timeline entry using new activity logging system
  const { logAppointmentActivity } = await import('@/lib/patient-activity')
  await logAppointmentActivity({
    patientId,
    appointmentId: appointment.id,
    action: 'created',
    title: `Appointment scheduled: ${eventMapping.visitTypeName}`,
    description: `Scheduled for ${start.toLocaleString()}`,
    metadata: {
      calBookingId: calBooking.uid || String(calBooking.id),
    },
  })

  return {
    appointmentId: appointment.id,
    calBookingId: calBooking.uid || String(calBooking.id),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    confirmationMessage: `Your appointment has been scheduled for ${start.toLocaleString('en-US', { timeZone: timezone })}. You will receive a confirmation email shortly.`,
  }
}

/**
 * Cancel an appointment
 */
export async function cancelAppointment(
  practiceId: string,
  appointmentId: string
): Promise<void> {
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      practiceId,
    },
  })

  if (!appointment) {
    throw new Error('Appointment not found')
  }

  const isOpenDentalLinked = !!appointment.calBookingId?.startsWith('opendental:')

  // Cancel in Cal.com only for Cal-booked appointments (not Open Dental links).
  if (appointment.calBookingId && !isOpenDentalLinked) {
    try {
      const calClient = await getCalClient(practiceId)
      await calClient.cancelBooking(appointment.calBookingId)
    } catch (error) {
      console.error('Error canceling Cal.com booking:', error)
      // Continue with local cancellation even if Cal.com fails
    }
  }

  // Update local appointment
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'cancelled' },
  })

  // For Open Dental-linked appointments, mark the OD appointment Broken (best-effort).
  if (isOpenDentalLinked) {
    try {
      await writeBackAppointmentToOpenDental({ practiceId, appointmentId })
    } catch (error) {
      console.error('Error canceling Open Dental appointment:', error)
    }
  }

  // Create timeline entry using new activity logging system
  const { logAppointmentActivity } = await import('@/lib/patient-activity')
  await logAppointmentActivity({
    patientId: appointment.patientId,
    appointmentId: appointment.id,
    action: 'cancelled',
    title: 'Appointment cancelled',
    description: `Appointment scheduled for ${appointment.startTime.toLocaleString()} was cancelled`,
  })
}

