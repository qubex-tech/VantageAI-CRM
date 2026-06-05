import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getSmsClient } from '@/lib/sms'
import { prisma } from '@/lib/db'
import { logPatientActivity } from '@/lib/patient-activity'
import { logOutboundCommunication } from '@/lib/communications/logging'
import { resolveSmsPracticeId } from '@/lib/resolve-sms-practice-id'
import { getTelnyxPracticeMismatchHint } from '@/lib/sms-practice-hints'

export const dynamic = 'force-dynamic'

/**
 * Send SMS to a patient via the configured SMS provider (Telnyx or Twilio)
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

    const normalizedPatientId =
      typeof patientId === 'string' && patientId.trim() !== '' ? patientId.trim() : null

    const practiceId = await resolveSmsPracticeId(user, {
      patientId: normalizedPatientId,
      queryPracticeId: req.nextUrl.searchParams.get('practiceId'),
    })

    if (!practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    if (normalizedPatientId) {
      const patient = await prisma.patient.findFirst({
        where: { id: normalizedPatientId, deletedAt: null },
        select: { id: true, practiceId: true },
      })
      if (!patient || patient.practiceId !== practiceId) {
        return NextResponse.json(
          { error: 'Patient does not belong to the practice used for this SMS send' },
          { status: 400 }
        )
      }
    }

    let smsClient
    try {
      smsClient = await getSmsClient(practiceId)
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'SMS integration is not configured. Please configure Telnyx or Twilio in Settings.'
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    const result = await smsClient.sendSms({
      to: String(to).trim(),
      body: String(message).trim(),
    })

    if (!result.success) {
      let errorMessage = result.error || 'Failed to send SMS'
      if (
        smsClient.provider === 'telnyx' &&
        (errorMessage.includes('Telnyx rejected the API key') ||
          errorMessage.includes('Invalid Telnyx API key') ||
          errorMessage.includes('Authenticate'))
      ) {
        const mismatchHint = await getTelnyxPracticeMismatchHint(practiceId)
        if (mismatchHint) {
          errorMessage = `${errorMessage} ${mismatchHint}`
        }
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

    const messagePreview = String(message).trim().length > 160
      ? `${String(message).trim().slice(0, 160)}...`
      : String(message).trim()

    let resolvedPatientId: string | null = null
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
        resolvedPatientId = patientId.trim()
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
          resolvedPatientId = patient.id
        }
      }
    } catch (error) {
      console.error('[SMS SEND] Error logging SMS activity:', error)
    }

    if (resolvedPatientId) {
      try {
        await logOutboundCommunication({
          practiceId,
          patientId: resolvedPatientId,
          channel: 'sms',
          body: String(message).trim(),
          userId: user.id,
          metadata: {
            to,
            providerMessageId: result.messageId,
          },
        })
      } catch (error) {
        console.error('[SMS SEND] Error logging inbox message:', error)
      }
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
