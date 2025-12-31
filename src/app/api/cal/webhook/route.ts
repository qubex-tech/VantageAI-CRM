import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyCalSignature, rateLimit } from '@/lib/middleware'
import { createAuditLog, createTimelineEntry } from '@/lib/audit'
import { syncBookingToPatient } from '@/lib/sync-booking-to-patient'

/**
 * Cal.com webhook endpoint
 * Handles booking created/updated/cancelled events
 * Documentation: https://cal.com/docs/developing/guides/automation/webhooks
 * 
 * Webhook payload structure (v2 API):
 * {
 *   "triggerEvent": "BOOKING_CREATED" | "BOOKING_CANCELLED" | "BOOKING_RESCHEDULED" | etc.,
 *   "createdAt": "2024-01-01T00:00:00.000Z",
 *   "payload": { ... }
 * }
 */
export async function POST(req: NextRequest) {
  // Log all incoming requests for debugging
  const requestId = `cal-webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  console.log(`[${requestId}] Cal.com webhook received`)
  
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    if (!rateLimit(`cal-webhook:${ip}`, 100, 60000)) {
      console.error(`[${requestId}] Rate limit exceeded for IP: ${ip}`)
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await req.text()
    console.log(`[${requestId}] Request body length: ${body.length}`)
    console.log(`[${requestId}] Request headers:`, {
      'x-cal-signature-256': req.headers.get('x-cal-signature-256') ? 'present' : 'missing',
      'x-cal-webhook-version': req.headers.get('x-cal-webhook-version') || 'not set',
      'content-type': req.headers.get('content-type'),
      'user-agent': req.headers.get('user-agent'),
    })

    // Cal.com uses x-cal-signature-256 header (not x-cal-signature)
    const signature = req.headers.get('x-cal-signature-256') || ''
    const webhookVersion = req.headers.get('x-cal-webhook-version') || '2021-10-20'

    // Verify webhook signature
    const secret = process.env.CALCOM_WEBHOOK_SECRET || 'vantageai' // Fallback to user's secret
    console.log(`[${requestId}] Secret configured: ${secret ? 'yes' : 'no'}`)
    
    if (secret && signature) {
      const isValid = verifyCalSignature(body, signature, secret)
      console.log(`[${requestId}] Signature verification: ${isValid ? 'valid' : 'invalid'}`)
      if (!isValid) {
        console.error(`[${requestId}] Cal.com webhook signature verification failed`)
        console.error(`[${requestId}] Expected signature format: hex-encoded HMAC-SHA256`)
        console.error(`[${requestId}] Received signature: ${signature.substring(0, 20)}...`)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else {
      console.warn(`[${requestId}] Skipping signature verification (secret or signature missing)`)
    }

    // Parse webhook payload
    let webhookData: any
    try {
      webhookData = JSON.parse(body)
      console.log(`[${requestId}] Parsed webhook data successfully`)
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse webhook body as JSON:`, parseError)
      console.error(`[${requestId}] Body preview:`, body.substring(0, 500))
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    // Log the structure to understand what we're receiving
    console.log(`[${requestId}] Webhook data structure:`, {
      hasTriggerEvent: !!webhookData.triggerEvent,
      triggerEvent: webhookData.triggerEvent,
      hasCreatedAt: !!webhookData.createdAt,
      hasPayload: !!webhookData.payload,
      payloadKeys: webhookData.payload ? Object.keys(webhookData.payload) : [],
      // Also check if payload is at root level (some webhook formats differ)
      rootKeys: Object.keys(webhookData),
    })

    // Handle different webhook payload formats
    // Some webhooks send data at root level, others nest it in a "payload" field
    const triggerEvent = webhookData.triggerEvent || webhookData.event || webhookData.type
    const createdAt = webhookData.createdAt || webhookData.timestamp
    const payload = webhookData.payload || webhookData.data || webhookData

    if (!triggerEvent) {
      console.error(`[${requestId}] No trigger event found in webhook data`)
      console.error(`[${requestId}] Full webhook data:`, JSON.stringify(webhookData, null, 2))
      return NextResponse.json({ error: 'Missing trigger event' }, { status: 400 })
    }

    console.log(`[${requestId}] Cal.com webhook received: ${triggerEvent} at ${createdAt || 'unknown time'}`)
    console.log(`[${requestId}] Webhook payload:`, JSON.stringify(payload, null, 2))

    // Extract booking information from payload
    // Cal.com v2 API structure may vary, so we check multiple possible locations
    const bookingId = payload?.id || payload?.bookingId || payload?.booking?.id
    const bookingUid = payload?.uid || payload?.booking?.uid
    const startTime = payload?.startTime || payload?.start || payload?.booking?.startTime
    const endTime = payload?.endTime || payload?.end || payload?.booking?.endTime
    const attendeeEmail = payload?.attendees?.[0]?.email || payload?.attendee?.email || payload?.email
    const attendeeName = payload?.attendees?.[0]?.name || payload?.attendee?.name || payload?.name
    const attendeePhone = payload?.attendees?.[0]?.phoneNumber || payload?.attendees?.[0]?.phone || payload?.phoneNumber || payload?.phone
    const organizerEmail = payload?.organizer?.email || payload?.user?.email
    const eventTypeId = payload?.eventTypeId || payload?.eventType?.id || payload?.event_type_id
    const title = payload?.title || payload?.eventTitle || payload?.eventType?.title || payload?.event_type?.title
    const location = payload?.location || payload?.booking?.location
    const cancellationReason = payload?.cancellationReason || payload?.reason
    const rescheduleUid = payload?.rescheduleUid || payload?.reschedule_uid
    const status = payload?.status || payload?.booking?.status

    console.log(`[${requestId}] Extracted booking data:`, {
      bookingId,
      bookingUid,
      startTime,
      endTime,
      attendeeEmail,
      attendeeName,
      attendeePhone,
      eventTypeId,
      title,
      status,
    })

    // Find appointment by calBookingId (using bookingId or uid)
    const calBookingId = bookingId?.toString() || bookingUid
    const possibleBookingIds = [
      bookingId?.toString(),
      bookingUid,
      bookingId, // In case it's stored as number
    ].filter(Boolean)
    
    console.log(`[${requestId}] Searching for appointment with calBookingId:`, possibleBookingIds)
    
    let appointment = possibleBookingIds.length > 0
      ? await prisma.appointment.findFirst({
          where: {
            OR: possibleBookingIds.map(id => ({ calBookingId: id })),
          },
          include: { patient: true },
        })
      : null
    
    console.log(`[${requestId}] Found appointment:`, appointment ? appointment.id : 'none')

    // Handle different trigger events
    switch (triggerEvent) {
      case 'BOOKING_CREATED':
      case 'booking.created': // Some webhook formats use lowercase
        // If appointment already exists (created by agent), update it
        if (appointment) {
          const existingAppointment = appointment
          console.log(`[${requestId}] Updating existing appointment:`, existingAppointment.id)
          await prisma.appointment.update({
            where: { id: existingAppointment.id },
            data: {
              status: status === 'ACCEPTED' ? 'confirmed' : 'scheduled',
              startTime: startTime ? new Date(startTime) : undefined,
              endTime: endTime ? new Date(endTime) : undefined,
              // Ensure calBookingId is set if it wasn't before
              calBookingId: calBookingId || existingAppointment.calBookingId,
            },
          })

          if (existingAppointment.patientId) {
            await createTimelineEntry({
              patientId: existingAppointment.patientId,
              type: 'appointment',
              title: 'Appointment confirmed via Cal.com',
              description: `Appointment for ${existingAppointment.visitType} was confirmed`,
              metadata: { appointmentId: existingAppointment.id, bookingId: calBookingId },
            })
          }
        } else {
          // If appointment doesn't exist, try to find or create patient and appointment
          console.log(`[${requestId}] Appointment not found, attempting to create from webhook`)
          
          // Try to find patient by email - need to search across all practices that have Cal integration
          const calIntegrations = await prisma.calIntegration.findMany({
            include: {
              practice: true,
            },
          })
          
          console.log(`[${requestId}] Found ${calIntegrations.length} Cal integrations`)
          
          // Search for patient in those practices
          let patient = null
          let practiceId = null
          
          if (attendeeEmail) {
            for (const integration of calIntegrations) {
              const foundPatient = await prisma.patient.findFirst({
                where: {
                  practiceId: integration.practiceId,
                  email: attendeeEmail,
                  deletedAt: null,
                },
              })
              
              if (foundPatient) {
                patient = foundPatient
                practiceId = integration.practiceId
                console.log(`[${requestId}] Found existing patient by email:`, patient.id)
                break
              }
            }
          }
          
          // If patient not found, try to find by phone number if available
          if (!patient && attendeePhone) {
            const phoneNumber = attendeePhone.replace(/\D/g, '')
            console.log(`[${requestId}] Searching for patient by phone:`, phoneNumber)
            for (const integration of calIntegrations) {
              const foundPatient = await prisma.patient.findFirst({
                where: {
                  practiceId: integration.practiceId,
                  phone: phoneNumber,
                  deletedAt: null,
                },
              })
              
              if (foundPatient) {
                patient = foundPatient
                practiceId = integration.practiceId
                console.log(`[${requestId}] Found existing patient by phone:`, patient.id)
                break
              }
            }
          }
          
          // If still no patient found but we have attendee name, create a basic patient record
          if (!patient && attendeeName && calIntegrations.length > 0) {
            // Use the first practice with Cal integration
            const targetIntegration = calIntegrations[0]
            practiceId = targetIntegration.practiceId
            
            console.log(`[${requestId}] Creating new patient from Cal.com webhook: ${attendeeName} (${attendeeEmail || 'no email'})`)
            
            // Create patient with information from booking
            const phoneForCreation = attendeePhone?.replace(/\D/g, '') || '000-000-0000'
            
            patient = await prisma.patient.create({
              data: {
                practiceId: targetIntegration.practiceId,
                name: attendeeName,
                email: attendeeEmail || undefined,
                phone: phoneForCreation,
                dateOfBirth: new Date('1900-01-01'), // Placeholder date when DOB is unknown
                preferredContactMethod: attendeeEmail ? 'email' : 'phone',
                notes: `Patient created from Cal.com booking (${calBookingId || 'unknown'})`,
              },
            })
            
            console.log(`[${requestId}] Created new patient:`, patient.id)
          }

          // If patient found or created, create appointment record
          if (patient && startTime && endTime && practiceId) {
            // Find Cal integration for this practice
            const calIntegration = await prisma.calIntegration.findFirst({
              where: {
                practiceId: practiceId,
              },
              include: {
                practice: true,
              },
            })

            if (calIntegration) {
              // Get event type mapping to determine visit type
              const eventMapping = eventTypeId
                ? await prisma.calEventTypeMapping.findFirst({
                    where: {
                      practiceId: calIntegration.practiceId,
                      calEventTypeId: eventTypeId.toString(),
                    },
                  })
                : null

              console.log(`[${requestId}] Creating appointment for patient ${patient.id}`)
              
              appointment = await prisma.appointment.create({
                data: {
                  practiceId: calIntegration.practiceId,
                  patientId: patient.id,
                  calBookingId: calBookingId || undefined,
                  startTime: new Date(startTime),
                  endTime: new Date(endTime),
                  timezone: payload?.organizer?.timeZone || payload?.timeZone || 'America/New_York',
                  visitType: eventMapping?.visitTypeName || title || 'Appointment',
                  status: status === 'ACCEPTED' ? 'confirmed' : 'scheduled',
                  reason: payload?.additionalNotes || payload?.responses?.notes?.value || payload?.notes || undefined,
                },
                include: { patient: true },
              })

              console.log(`[${requestId}] Created appointment:`, appointment.id)

              if (appointment.patientId) {
                await createTimelineEntry({
                  patientId: appointment.patientId,
                  type: 'appointment',
                  title: 'Appointment created via Cal.com',
                  description: `Appointment for ${appointment.visitType} was created`,
                  metadata: { appointmentId: appointment.id, bookingId: calBookingId },
                })
              }
            } else {
              console.error(`[${requestId}] Cal integration not found for practice ${practiceId}`)
            }
          } else {
            console.warn(`[${requestId}] Cannot create appointment - missing data:`, {
              hasPatient: !!patient,
              hasStartTime: !!startTime,
              hasEndTime: !!endTime,
              hasPracticeId: !!practiceId,
            })
          }
        }
        break

      case 'BOOKING_CANCELLED':
      case 'booking.cancelled':
        if (appointment) {
          await prisma.appointment.update({
            where: { id: appointment.id },
            data: { status: 'cancelled' },
          })

          if (appointment.patientId) {
            await createTimelineEntry({
              patientId: appointment.patientId,
              type: 'appointment',
              title: 'Appointment cancelled',
              description: cancellationReason
                ? `Appointment cancelled: ${cancellationReason}`
                : `Appointment for ${appointment.visitType} was cancelled`,
              metadata: { appointmentId: appointment.id, cancellationReason },
            })
          }
        } else {
          console.warn(`[${requestId}] Cal.com webhook: Appointment not found for cancellation`, calBookingId)
        }
        break

      case 'BOOKING_RESCHEDULED':
      case 'booking.rescheduled':
        if (appointment && startTime && endTime) {
          await prisma.appointment.update({
            where: { id: appointment.id },
            data: {
              startTime: new Date(startTime),
              endTime: new Date(endTime),
              status: 'confirmed',
            },
          })

          if (appointment.patientId) {
            await createTimelineEntry({
              patientId: appointment.patientId,
              type: 'appointment',
              title: 'Appointment rescheduled',
              description: `Appointment for ${appointment.visitType} was rescheduled`,
              metadata: { appointmentId: appointment.id, rescheduleUid },
            })
          }
        } else {
          console.warn(`[${requestId}] Cal.com webhook: Appointment not found for reschedule`, calBookingId)
        }
        break

      case 'MEETING_ENDED':
      case 'meeting.ended':
        if (appointment) {
          // Optionally update appointment status or create timeline entry
          if (appointment.patientId) {
            await createTimelineEntry({
              patientId: appointment.patientId,
              type: 'appointment',
              title: 'Meeting ended',
              description: `Meeting for ${appointment.visitType} has ended`,
              metadata: { appointmentId: appointment.id },
            })
          }
        }
        break

      default:
        console.log(`[${requestId}] Cal.com webhook: Unhandled trigger event: ${triggerEvent}`)
        console.log(`[${requestId}] Full webhook data:`, JSON.stringify(webhookData, null, 2))
    }

    // Create audit log if appointment was found/created
    if (appointment) {
      try {
        const adminUser = await prisma.user.findFirst({
          where: { practiceId: appointment.practiceId },
          orderBy: { createdAt: 'asc' },
        })

        if (adminUser) {
          await createAuditLog({
            practiceId: appointment.practiceId,
            userId: adminUser.id,
            action: triggerEvent === 'BOOKING_CREATED' || triggerEvent === 'booking.created' ? 'create' : 'update',
            resourceType: 'appointment',
            resourceId: appointment.id,
            changes: { after: webhookData },
            ipAddress: req.headers.get('x-forwarded-for') || undefined,
          })
        }
      } catch (auditError) {
        // Log error but don't fail webhook processing
        console.error(`[${requestId}] Failed to create audit log for Cal.com webhook:`, auditError)
      }
    }

    console.log(`[${requestId}] Webhook processing completed successfully`)
    return NextResponse.json({ status: 'ok', message: 'Webhook processed', requestId })
  } catch (error) {
    console.error(`[${requestId}] Cal.com webhook error:`, error)
    if (error instanceof Error) {
      console.error(`[${requestId}] Error stack:`, error.stack)
    }
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Webhook processing failed',
        requestId,
      },
      { status: 500 }
    )
  }
}
