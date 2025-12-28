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
  // Normalize phone number (remove non-digits)
  const normalizedPhone = phone.replace(/\D/g, '')
  
  // Try to find existing patient - use exact match on normalized phone
  // First try exact match on normalized phone
  let patient = await prisma.patient.findFirst({
    where: {
      practiceId,
      phone: normalizedPhone,
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
      },
    })

    const matchedPatient = allPatients.find(p => p.phone.replace(/\D/g, '') === normalizedPhone)
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

    // Create timeline entry
    await createTimelineEntry({
      patientId: patient.id,
      type: 'note',
      title: 'Patient created via voice call',
      description: 'Patient was created during a phone conversation',
    })
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

  // Create Cal.com booking
  const calClient = await getCalClient(practiceId)
  const calBooking = await calClient.createBooking({
    eventTypeId,
    start: startTime,
    end: end.toISOString(),
    timeZone: timezone,
    responses: {
      name: patient.name,
      email: patient.email || '',
      phone: patient.phone,
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
      calBookingId: calBooking.id ?? calBooking.uid,
    },
  })

  // Create timeline entry
  await createTimelineEntry({
    patientId,
    type: 'appointment',
    title: `Appointment scheduled: ${eventMapping.visitTypeName}`,
    description: `Scheduled for ${start.toLocaleString()}`,
    metadata: {
      appointmentId: appointment.id,
      calBookingId: calBooking.id,
    },
  })

  return {
    appointmentId: appointment.id,
    calBookingId: calBooking.id ?? calBooking.uid,
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

  // Cancel in Cal.com if booking ID exists
  if (appointment.calBookingId) {
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

  // Create timeline entry
  await createTimelineEntry({
    patientId: appointment.patientId,
    type: 'appointment',
    title: 'Appointment cancelled',
    description: `Appointment scheduled for ${appointment.startTime.toLocaleString()} was cancelled`,
    metadata: {
      appointmentId: appointment.id,
    },
  })
}

