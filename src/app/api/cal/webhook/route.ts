import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyCalSignature, rateLimit } from '@/lib/middleware'
import { createAuditLog, createTimelineEntry } from '@/lib/audit'

/**
 * Cal.com webhook endpoint
 * Handles booking created/updated/cancelled events
 * Documentation: https://cal.com/docs/developing/guides/automation/webhooks
 * 
 * Webhook payload structure:
 * {
 *   "triggerEvent": "BOOKING_CREATED" | "BOOKING_CANCELLED" | "BOOKING_RESCHEDULED" | etc.,
 *   "createdAt": "2024-01-01T00:00:00.000Z",
 *   "payload": { ... }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    if (!rateLimit(`cal-webhook:${ip}`, 100, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await req.text()
    // Cal.com uses x-cal-signature-256 header (not x-cal-signature)
    const signature = req.headers.get('x-cal-signature-256') || ''
    const webhookVersion = req.headers.get('x-cal-webhook-version') || '2021-10-20'

    // Verify webhook signature
    const secret = process.env.CALCOM_WEBHOOK_SECRET
    if (secret && !verifyCalSignature(body, signature, secret)) {
      console.error('Cal.com webhook signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse webhook payload according to Cal.com documentation
    const webhookData = JSON.parse(body)
    const { triggerEvent, createdAt, payload } = webhookData

    console.log(`Cal.com webhook received: ${triggerEvent} at ${createdAt}`)

    // Extract booking information from payload
    const bookingId = payload?.bookingId
    const bookingUid = payload?.uid
    const startTime = payload?.startTime
    const endTime = payload?.endTime
    const attendeeEmail = payload?.attendees?.[0]?.email
    const attendeeName = payload?.attendees?.[0]?.name
    const organizerEmail = payload?.organizer?.email
    const eventTypeId = payload?.eventTypeId
    const title = payload?.title || payload?.eventTitle
    const location = payload?.location
    const cancellationReason = payload?.cancellationReason
    const rescheduleUid = payload?.rescheduleUid

    // Find appointment by calBookingId (using bookingId or uid)
    const calBookingId = bookingId?.toString() || bookingUid
    let appointment = calBookingId
      ? await prisma.appointment.findFirst({
          where: {
            OR: [
              { calBookingId: calBookingId },
              { calBookingId: bookingId?.toString() },
              { calBookingId: bookingUid },
            ],
          },
          include: { patient: true },
        })
      : null

    // Handle different trigger events
    switch (triggerEvent) {
      case 'BOOKING_CREATED':
        // If appointment doesn't exist, try to find or create patient and appointment
        if (!appointment && attendeeEmail) {
          // Try to find patient by email
          const patient = await prisma.patient.findFirst({
            where: {
              email: attendeeEmail,
              deletedAt: null,
            },
          })

          // If patient found, create appointment record
          if (patient && startTime && endTime) {
            // Find which practice this belongs to (we need organizer email or event type mapping)
            // For now, we'll try to find a practice with a Cal integration
            const calIntegration = await prisma.calIntegration.findFirst({
              where: {
                // We can't directly match organizer email, so we'll need to handle this differently
                // For now, create appointment if we can find the practice via patient
              },
              include: {
                practice: true,
              },
            })

            if (calIntegration && patient.practiceId === calIntegration.practiceId) {
              // Get event type mapping to determine visit type
              const eventMapping = eventTypeId
                ? await prisma.calEventTypeMapping.findFirst({
                    where: {
                      practiceId: calIntegration.practiceId,
                      calEventTypeId: eventTypeId.toString(),
                    },
                  })
                : null

              appointment = await prisma.appointment.create({
                data: {
                  practiceId: calIntegration.practiceId,
                  patientId: patient.id,
                  calBookingId: calBookingId || undefined,
                  startTime: new Date(startTime),
                  endTime: new Date(endTime),
                  timezone: payload?.organizer?.timeZone || 'America/New_York',
                  visitType: eventMapping?.visitTypeName || title || 'Appointment',
                  status: payload?.status === 'ACCEPTED' ? 'confirmed' : 'scheduled',
                  reason: payload?.additionalNotes || payload?.responses?.notes?.value || undefined,
                },
                include: { patient: true },
              })

              if (appointment.patientId) {
                await createTimelineEntry({
                  patientId: appointment.patientId,
                  type: 'appointment',
                  title: 'Appointment created via Cal.com',
                  description: `Appointment for ${appointment.visitType} was created`,
                  metadata: { appointmentId: appointment.id, bookingId: calBookingId },
                })
              }
            }
          }
        } else if (appointment) {
          // Update existing appointment
          await prisma.appointment.update({
            where: { id: appointment.id },
            data: {
              status: payload?.status === 'ACCEPTED' ? 'confirmed' : 'scheduled',
              startTime: startTime ? new Date(startTime) : undefined,
              endTime: endTime ? new Date(endTime) : undefined,
            },
          })

          if (appointment.patientId) {
            await createTimelineEntry({
              patientId: appointment.patientId,
              type: 'appointment',
              title: 'Appointment confirmed',
              description: `Appointment for ${appointment.visitType} was confirmed via Cal.com`,
              metadata: { appointmentId: appointment.id },
            })
          }
        }
        break

      case 'BOOKING_CANCELLED':
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
          console.warn('Cal.com webhook: Appointment not found for cancellation', calBookingId)
        }
        break

      case 'BOOKING_RESCHEDULED':
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
          console.warn('Cal.com webhook: Appointment not found for reschedule', calBookingId)
        }
        break

      case 'MEETING_ENDED':
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
        console.log(`Cal.com webhook: Unhandled trigger event: ${triggerEvent}`)
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
            action: triggerEvent === 'BOOKING_CREATED' ? 'create' : 'update',
            resourceType: 'appointment',
            resourceId: appointment.id,
            changes: { after: webhookData },
            ipAddress: req.headers.get('x-forwarded-for') || undefined,
          })
        }
      } catch (auditError) {
        // Log error but don't fail webhook processing
        console.error('Failed to create audit log for Cal.com webhook:', auditError)
      }
    }

    return NextResponse.json({ status: 'ok', message: 'Webhook processed' })
  } catch (error) {
    console.error('Cal.com webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

