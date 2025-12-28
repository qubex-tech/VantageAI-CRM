import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyCalSignature, rateLimit } from '@/lib/middleware'
import { createAuditLog, createTimelineEntry } from '@/lib/audit'

/**
 * Cal.com webhook endpoint
 * Handles booking created/updated/cancelled events
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    if (!rateLimit(`cal-webhook:${ip}`, 100, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await req.text()
    const signature = req.headers.get('x-cal-signature') || ''

    // Verify webhook signature
    const secret = process.env.CALCOM_WEBHOOK_SECRET
    if (secret && !verifyCalSignature(body, signature, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(body)
    const { type, data } = event

    // Find appointment by calBookingId
    const appointment = await prisma.appointment.findUnique({
      where: { calBookingId: data?.booking?.id ?? data?.booking?.uid },
      include: { patient: true },
    })

    if (!appointment) {
      // Booking might be for a different practice or not yet synced
      console.warn('Cal.com webhook: Appointment not found', data?.booking?.id)
      return NextResponse.json({ status: 'ok', message: 'Appointment not found' })
    }

    // Update appointment status based on event type
    switch (type) {
      case 'BOOKING_CREATED':
      case 'BOOKING_CONFIRMED':
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: 'confirmed' },
        })

        if (appointment.patientId) {
          await createTimelineEntry({
            patientId: appointment.patientId,
            type: 'appointment',
            title: 'Appointment confirmed',
            description: `Appointment for ${appointment.visitType} was confirmed`,
            metadata: { appointmentId: appointment.id },
          })
        }
        break

      case 'BOOKING_CANCELLED':
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: 'cancelled' },
        })

        if (appointment.patientId) {
          await createTimelineEntry({
            patientId: appointment.patientId,
            type: 'appointment',
            title: 'Appointment cancelled',
            description: `Appointment for ${appointment.visitType} was cancelled`,
            metadata: { appointmentId: appointment.id },
          })
        }
        break

      case 'BOOKING_RESCHEDULED':
        if (data?.booking?.startTime) {
          await prisma.appointment.update({
            where: { id: appointment.id },
            data: {
              startTime: new Date(data.booking.startTime),
              endTime: new Date(data.booking.endTime),
              status: 'confirmed',
            },
          })
        }
        break
    }

    // Create audit log - use first admin user for system actions
    // Skip audit log if no users exist (shouldn't happen in production)
    try {
      const adminUser = await prisma.user.findFirst({
        where: { practiceId: appointment.practiceId },
        orderBy: { createdAt: 'asc' },
      })

      if (adminUser) {
        await createAuditLog({
          practiceId: appointment.practiceId,
          userId: adminUser.id,
          action: 'update',
          resourceType: 'appointment',
          resourceId: appointment.id,
          changes: { after: event },
          ipAddress: req.headers.get('x-forwarded-for') || undefined,
        })
      }
    } catch (auditError) {
      // Log error but don't fail webhook processing
      console.error('Failed to create audit log for Cal.com webhook:', auditError)
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Cal.com webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

