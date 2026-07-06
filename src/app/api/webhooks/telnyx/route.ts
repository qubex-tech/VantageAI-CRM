import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logInboundCommunication } from '@/lib/communications/logging'
import { resolveInboundSmsPatient } from '@/lib/telnyx-inbound'
import {
  assertTelnyxWebhookVerified,
  resolveTelnyxWebhookPublicKey,
  TelnyxWebhookVerificationError,
} from '@/lib/telnyx-webhook'
import { handleSlotFillInboundSms } from '@/lib/appointment-optimization/slotFillInboundReply'

export const dynamic = 'force-dynamic'

interface TelnyxWebhookEvent {
  data?: {
    event_type?: string
    payload?: {
      id?: string
      direction?: string
      text?: string | null
      messaging_profile_id?: string
      from?: { phone_number?: string }
      to?: Array<{ phone_number?: string; status?: string }>
    }
  }
}

/**
 * POST /api/webhooks/telnyx
 * Handle Telnyx messaging webhooks (inbound SMS, delivery status).
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('telnyx-signature-ed25519')
    const timestamp = req.headers.get('telnyx-timestamp')
    const publicKey = await resolveTelnyxWebhookPublicKey()

    try {
      assertTelnyxWebhookVerified({
        rawBody,
        signature,
        timestamp,
        publicKey,
      })
    } catch (error) {
      if (error instanceof TelnyxWebhookVerificationError) {
        console.error('[Telnyx webhook] Verification failed:', error.message)
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      throw error
    }

    const body = rawBody ? (JSON.parse(rawBody) as TelnyxWebhookEvent) : {}
    const eventType = body.data?.event_type
    const payload = body.data?.payload

    if (!eventType || !payload) {
      return NextResponse.json({ success: true })
    }

    if (eventType === 'message.received') {
      await handleInboundMessage(payload, req)
    } else if (eventType === 'message.finalized') {
      await handleDeliveryStatus(payload)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Telnyx webhook] Unexpected error:', error)
    return NextResponse.json({ success: true })
  }
}

async function handleInboundMessage(
  payload: NonNullable<TelnyxWebhookEvent['data']>['payload'],
  req: NextRequest
) {
  if (payload?.direction && payload.direction !== 'inbound') {
    return
  }

  const bodyText = payload?.text?.trim()
  const from = payload?.from?.phone_number
  const toNumbers = (payload?.to || [])
    .map((entry) => entry.phone_number)
    .filter(Boolean) as string[]

  if (!bodyText || !from || toNumbers.length === 0) {
    console.warn('[Telnyx webhook] Skipping inbound message with missing text, from, or to', {
      hasText: Boolean(bodyText),
      from,
      toCount: toNumbers.length,
    })
    return
  }

  const inboundContext = await resolveInboundSmsPatient({
    from,
    messagingProfileId: payload.messaging_profile_id,
    toNumbers,
  })

  if (!inboundContext) {
    console.warn('[Telnyx webhook] No active Telnyx integration matched inbound message', {
      from,
      to: toNumbers[0],
      messagingProfileId: payload.messaging_profile_id,
    })
    return
  }

  const { patient, integrationPracticeIds } = inboundContext

  if (bodyText.toUpperCase() === 'STOP') {
    if (!patient) {
      console.warn('[Telnyx webhook] STOP received but patient not found for', from)
      return
    }
    await handleStopOptOut(patient, from, req)
    return
  }

  if (!patient) {
    console.warn('[Telnyx webhook] Inbound SMS patient not matched', {
      from,
      telnyxPracticeIds: integrationPracticeIds,
      to: toNumbers[0],
      messagingProfileId: payload.messaging_profile_id,
    })
    return
  }

  await logInboundCommunication({
    practiceId: patient.practiceId,
    patientId: patient.id,
    channel: 'sms',
    body: bodyText,
    metadata: {
      from,
      to: toNumbers[0],
      providerMessageId: payload.id,
      provider: 'telnyx',
      telnyxIntegrationPracticeIds: integrationPracticeIds,
    },
  })

  try {
    const slotFillResult = await handleSlotFillInboundSms({
      practiceId: patient.practiceId,
      patientId: patient.id,
      body: bodyText,
    })
    if (slotFillResult.handled) {
      console.info('[SlotFill] inbound SMS handled', {
        practiceId: patient.practiceId,
        patientId: patient.id,
        action: slotFillResult.action,
        reason: slotFillResult.reason,
      })
    }
  } catch (error) {
    console.error('[SlotFill] inbound SMS handler failed', error)
  }
}

async function handleStopOptOut(
  patient: { id: string; practiceId: string },
  from: string,
  req: NextRequest
) {
  const normalizedFrom = from.replace(/[^\d]/g, '')

  await prisma.communicationPreference.upsert({
    where: { patientId: patient.id },
    create: {
      practiceId: patient.practiceId,
      patientId: patient.id,
      smsEnabled: false,
      emailEnabled: true,
      voiceEnabled: false,
      portalEnabled: true,
    },
    update: {
      smsEnabled: false,
    },
  })

  await prisma.consentRecord.create({
    data: {
      practiceId: patient.practiceId,
      patientId: patient.id,
      consentType: 'sms',
      consented: false,
      method: 'sms',
      source: normalizedFrom,
      revokedAt: new Date(),
    },
  })

  await prisma.portalAuditLog.create({
    data: {
      practiceId: patient.practiceId,
      patientId: patient.id,
      action: 'opt_out',
      resourceType: 'communication_preference',
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    },
  })
}

async function handleDeliveryStatus(
  payload: NonNullable<TelnyxWebhookEvent['data']>['payload']
) {
  const messageId = payload?.id
  const status = payload?.to?.[0]?.status
  if (!messageId || !status) {
    return
  }

  const messages = await prisma.portalMessage.findMany({
    where: {
      channel: 'SMS',
      status: { in: ['sent', 'delivered', 'failed'] },
    },
    take: 100,
  })

  const matchingMessages = messages.filter((msg) => {
    const metadata = msg.metadata as { providerMessageId?: string } | null
    return metadata?.providerMessageId === messageId
  })

  if (matchingMessages.length === 0) {
    return
  }

  const mappedStatus =
    status === 'delivered' ? 'delivered' : status === 'delivery_failed' ? 'failed' : 'sent'

  await prisma.portalMessage.updateMany({
    where: {
      id: { in: matchingMessages.map((entry) => entry.id) },
    },
    data: {
      status: mappedStatus,
    },
  })
}
