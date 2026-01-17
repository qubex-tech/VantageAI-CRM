import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getTwilioClient } from '@/lib/twilio'
import { prisma } from '@/lib/db'
import { logPatientActivity } from '@/lib/patient-activity'

export const dynamic = 'force-dynamic'

/**
 * Send SMS to a patient via Twilio
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const { to, message, patientId } = body

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to and message are required' },
        { status: 400 }
      )
    }

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

    let twilioClient
    try {
      twilioClient = await getTwilioClient(practiceId)
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Twilio integration is not configured. Please configure it in Settings → Twilio SMS Integration.'
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    const result = await twilioClient.sendSms({
      to: String(to).trim(),
      body: String(message).trim(),
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send SMS via Twilio' },
        { status: 500 }
      )
    }

    const messagePreview = String(message).trim().length > 160
      ? `${String(message).trim().slice(0, 160)}...`
      : String(message).trim()

    try {
      if (patientId && typeof patientId === 'string' && patientId.trim() !== '') {
        await logPatientActivity({
          patientId: patientId.trim(),
          type: 'call',
          title: `SMS sent to ${to}`,
          description: messagePreview,
          metadata: {
            to,
            messageId: result.messageId,
            userId: user.id,
          },
        })
      } else {
        const patient = await prisma.patient.findFirst({
          where: {
            practiceId,
            deletedAt: null,
            OR: [
              { phone: String(to).trim() },
              { primaryPhone: String(to).trim() },
              { secondaryPhone: String(to).trim() },
            ],
          },
          select: { id: true },
        })

        if (patient) {
          await logPatientActivity({
            patientId: patient.id,
            type: 'call',
            title: `SMS sent to ${to}`,
            description: messagePreview,
            metadata: {
              to,
              messageId: result.messageId,
              userId: user.id,
            },
          })
        }
      }
    } catch (error) {
      console.error('[SMS SEND] Error logging SMS activity:', error)
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    })
  } catch (error) {
    console.error('[SMS SEND] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send SMS' },
      { status: 500 }
    )
  }
}
