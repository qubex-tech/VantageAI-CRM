/**
 * Sync Cal.com Booking to Patient Record
 * 
 * When a Cal.com booking is received, this function:
 * 1. Checks if attendee matches existing patients (by name, phone, or email)
 * 2. If match found: merges/appends information and adds timeline entry
 * 3. If no match: creates new patient record with all available information
 */

import { prisma } from './db'
import { CalBooking } from './cal'
import { getCalClient } from './cal'
import { logAppointmentActivity, logCustomActivity } from './patient-activity'

export interface SyncBookingResult {
  patientId: string
  isNew: boolean
  patient: {
    id: string
    name: string
    phone: string | null
    email: string | null
  }
}

/**
 * Sync a Cal.com booking to a patient record
 */
export async function syncBookingToPatient(
  practiceId: string,
  booking: CalBooking,
  userId?: string
): Promise<SyncBookingResult> {
  console.log('[syncBookingToPatient] Starting sync for booking:', booking.uid || booking.id, 'practiceId:', practiceId)
  
  const attendee = booking.attendees?.[0]
  if (!attendee) {
    console.error('[syncBookingToPatient] No attendee information in booking')
    throw new Error('No attendee information in booking')
  }

  const attendeeName = attendee.name
  const attendeeEmail = attendee.email
  const attendeePhone = attendee.phoneNumber

  console.log('[syncBookingToPatient] Attendee info:', { name: attendeeName, email: attendeeEmail, phone: attendeePhone })

  if (!attendeeName && !attendeeEmail && !attendeePhone) {
    console.error('[syncBookingToPatient] No identifiable information in booking')
    throw new Error('No identifiable information in booking (name, email, or phone required)')
  }

  // Normalize phone number for matching
  const normalizedPhone = attendeePhone?.replace(/\D/g, '') || null

  // Try to find existing patient by email, phone, or name
  let patient = null
  let matchReason = ''

  // First, try by email (most reliable)
  if (attendeeEmail) {
    patient = await prisma.patient.findFirst({
      where: {
        practiceId,
        email: attendeeEmail,
        deletedAt: null,
      },
    })
    if (patient) {
      matchReason = 'email'
    }
  }

  // If no match by email, try by phone
  if (!patient && normalizedPhone) {
    patient = await prisma.patient.findFirst({
      where: {
        practiceId,
        phone: normalizedPhone,
        deletedAt: null,
      },
    })
    if (patient) {
      matchReason = 'phone'
    }

    // Also try normalized matching
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

      const matchedPatient = allPatients.find(p => p.phone?.replace(/\D/g, '') === normalizedPhone)
      if (matchedPatient) {
        patient = await prisma.patient.findUnique({
          where: { id: matchedPatient.id },
        })
        if (patient) {
          matchReason = 'phone_normalized'
        }
      }
    }
  }

  // If still no match, try by name (less reliable, so we do it last)
  if (!patient && attendeeName) {
    // Use contains for name matching (case-insensitive)
    const nameMatches = await prisma.patient.findMany({
      where: {
        practiceId,
        name: {
          contains: attendeeName,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
    })

    // Prefer exact match, then partial match
    patient = nameMatches.find(p => p.name.toLowerCase() === attendeeName.toLowerCase()) || nameMatches[0]
    if (patient) {
      matchReason = 'name'
    }
  }

  const isNew = !patient

  // Prepare update/create data
  const updateData: any = {}

  if (attendeeName && (!patient || attendeeName !== patient.name)) {
    updateData.name = attendeeName
  }

  if (attendeeEmail && (!patient || !patient.email || attendeeEmail !== patient.email)) {
    updateData.email = attendeeEmail
  }

  if (normalizedPhone && (!patient || !patient.phone || normalizedPhone !== (patient.phone ? String(patient.phone).replace(/\D/g, '') : ''))) {
    updateData.phone = normalizedPhone
  }

  // Update preferred contact method based on what we have
  if (attendeeEmail) {
    updateData.preferredContactMethod = 'email'
  } else if (normalizedPhone) {
    updateData.preferredContactMethod = 'phone'
  }

  // Add booking information to notes
  const notesParts: string[] = []
  if (booking.title) notesParts.push(`Booking: ${booking.title}`)
  if (booking.description) notesParts.push(`Description: ${booking.description}`)
  if (booking.location) notesParts.push(`Location: ${booking.location}`)
  
  const bookingNote = `[Cal.com Booking ${booking.uid || booking.id}]\n${notesParts.join('\n')}`
  
  if (patient?.notes) {
    // Check if this booking note already exists
    if (!patient.notes.includes(`[Cal.com Booking ${booking.uid || booking.id}]`)) {
      updateData.notes = `${patient.notes}\n\n${bookingNote}`
    }
  } else {
    updateData.notes = bookingNote
  }

  if (patient) {
    // Update existing patient with new information
    const updatedPatient = await prisma.patient.update({
      where: { id: patient.id },
      data: updateData,
    })

    // Check if timeline entry already exists for this booking to avoid duplicates
    const bookingId = booking.uid || String(booking.id)
    const existingTimelineEntry = await prisma.patientTimelineEntry.findFirst({
      where: {
        patientId: updatedPatient.id,
        type: 'appointment',
        metadata: {
          path: ['bookingId'],
          equals: bookingId,
        },
      },
    })

    // Check if appointment already exists for this booking
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        patientId: updatedPatient.id,
        calBookingId: bookingId,
      },
    })

    // Create or get appointment for timeline entry
    let appointmentForTimeline = existingAppointment

    // Create appointment if it doesn't exist
    if (!existingAppointment && booking.start && booking.end) {
      try {
        // Try to get event type mapping to determine visit type
        const calIntegration = await prisma.calIntegration.findFirst({
          where: { practiceId },
          include: {
            practice: true,
          },
        })

        let visitType = booking.title || 'Appointment'
        if (calIntegration && booking.eventTypeId) {
          const eventMapping = await prisma.calEventTypeMapping.findFirst({
            where: {
              practiceId: calIntegration.practiceId,
              calEventTypeId: String(booking.eventTypeId),
            },
          })
          if (eventMapping) {
            visitType = eventMapping.visitTypeName
          }
        }

        await prisma.appointment.create({
          data: {
            practiceId,
            patientId: updatedPatient.id,
            startTime: new Date(booking.start),
            endTime: new Date(booking.end),
            timezone: booking.attendees?.[0]?.timeZone || 'America/New_York',
            visitType: visitType,
            status: booking.status === 'ACCEPTED' || booking.status === 'accepted' ? 'confirmed' : 'scheduled',
            calBookingId: bookingId,
            calEventId: booking.eventTypeId ? String(booking.eventTypeId) : undefined,
            reason: booking.description || undefined,
          },
        })
        console.log(`[syncBookingToPatient] Created appointment for booking ${bookingId}`)
      } catch (error) {
        console.error(`[syncBookingToPatient] Error creating appointment for booking ${bookingId}:`, error)
        // Don't throw - appointment creation is optional
      }
    }

    // Only create timeline entry if it doesn't already exist and we have an appointment
    if (!existingTimelineEntry && appointmentForTimeline) {
      await logAppointmentActivity({
        patientId: updatedPatient.id,
        appointmentId: appointmentForTimeline.id,
        action: 'created',
        title: 'Appointment booking synced from Cal.com',
        description: `Booking ${booking.title || 'appointment'} synced from Cal.com (matched by ${matchReason})`,
        metadata: {
          bookingId: booking.uid || String(booking.id),
          bookingTitle: booking.title,
          bookingStart: booking.start,
          bookingEnd: booking.end,
          matchReason,
        },
      })
    }

    return {
      patientId: updatedPatient.id,
      isNew: false,
      patient: {
        id: updatedPatient.id,
        name: updatedPatient.name,
        phone: updatedPatient.phone,
        email: updatedPatient.email,
      },
    }
  } else {
    // Create new patient with all available information
    if (!attendeeName) {
      throw new Error('Cannot create patient without name')
    }

    const phoneForCreation = normalizedPhone || '000-000-0000'

    console.log('[syncBookingToPatient] Creating new patient:', { name: attendeeName, email: attendeeEmail, phone: phoneForCreation, practiceId })
    
    const newPatient = await prisma.patient.create({
      data: {
        practiceId,
        name: attendeeName,
        email: attendeeEmail || undefined,
        phone: phoneForCreation,
        dateOfBirth: new Date('1900-01-01'), // Placeholder date when DOB is unknown
        preferredContactMethod: attendeeEmail ? 'email' : 'phone',
        notes: bookingNote,
      },
    })

    console.log('[syncBookingToPatient] Created new patient:', newPatient.id, 'practiceId:', newPatient.practiceId)

    // Check if timeline entry already exists for this booking to avoid duplicates
    const bookingId = booking.uid || String(booking.id)
    const existingTimelineEntry = await prisma.patientTimelineEntry.findFirst({
      where: {
        patientId: newPatient.id,
        type: 'appointment',
        metadata: {
          path: ['bookingId'],
          equals: bookingId,
        },
      },
    })

    // Only create timeline entry if it doesn't already exist
    if (!existingTimelineEntry) {
      await logCustomActivity({
        patientId: newPatient.id,
        type: 'note',
        title: 'Patient created from Cal.com booking',
        description: `Patient created from Cal.com booking: ${booking.title || 'appointment'}`,
        metadata: {
          bookingId: booking.uid || String(booking.id),
          bookingTitle: booking.title,
          bookingStart: booking.start,
          bookingEnd: booking.end,
          source: 'cal.com_booking',
        },
      })
    }

    // Create appointment if it doesn't exist
    if (booking.start && booking.end) {
      try {
        // Try to get event type mapping to determine visit type
        const calIntegration = await prisma.calIntegration.findFirst({
          where: { practiceId },
          include: {
            practice: true,
          },
        })

        let visitType = booking.title || 'Appointment'
        if (calIntegration && booking.eventTypeId) {
          const eventMapping = await prisma.calEventTypeMapping.findFirst({
            where: {
              practiceId: calIntegration.practiceId,
              calEventTypeId: String(booking.eventTypeId),
            },
          })
          if (eventMapping) {
            visitType = eventMapping.visitTypeName
          }
        }

        await prisma.appointment.create({
          data: {
            practiceId,
            patientId: newPatient.id,
            startTime: new Date(booking.start),
            endTime: new Date(booking.end),
            timezone: booking.attendees?.[0]?.timeZone || 'America/New_York',
            visitType: visitType,
            status: booking.status === 'ACCEPTED' || booking.status === 'accepted' ? 'confirmed' : 'scheduled',
            calBookingId: bookingId,
            calEventId: booking.eventTypeId ? String(booking.eventTypeId) : undefined,
            reason: booking.description || undefined,
          },
        })
        console.log(`[syncBookingToPatient] Created appointment for new patient booking ${bookingId}`)
      } catch (error) {
        console.error(`[syncBookingToPatient] Error creating appointment for new patient booking ${bookingId}:`, error)
        // Don't throw - appointment creation is optional
      }
    }

    console.log('[syncBookingToPatient] Created timeline entry for new patient:', newPatient.id)

    return {
      patientId: newPatient.id,
      isNew: true,
      patient: {
        id: newPatient.id,
        name: newPatient.name,
        phone: newPatient.phone,
        email: newPatient.email,
      },
    }
  }
}

