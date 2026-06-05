import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logInboundCommunication } from '@/lib/communications/logging'
import { phoneNumbersMatch } from '@/lib/telnyx'
import {
  assertTelnyxWebhookVerified,
  resolveTelnyxWebhookPublicKey,
  TelnyxWebhookVerificationError,
} from '@/lib/telnyx-webhook'

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
        console.error('Telnyx webhook verification failed:', error.message)
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
    console.error('Telnyx webhook error:', error)
    return NextResponse.json({ success: true })
  }
}

async function handleInboundMessage(
  payload: NonNullable<TelnyxWebhookEvent['data']>['payload'],
  req: NextRequest
) {
  const bodyText = payload?.text?.trim()
  const from = payload?.from?.phone_number
  const toNumbers = (payload?.to || [])
    .map((entry) => entry.phone_number)
    .filter(Boolean) as string[]

  if (!bodyText || !from || toNumbers.length === 0) {
    return
  }

  const normalizedFrom = from.replace(/[^\d]/g, '')
  const fromLast10 = normalizedFrom.slice(-10)

  if (bodyText.toUpperCase() === 'STOP') {
    const patient = await prisma.patient.findFirst({
      where: {
        OR: [
          { phone: { contains: normalizedFrom } },
          { primaryPhone: { contains: normalizedFrom } },
          { secondaryPhone: { contains: normalizedFrom } },
        ],
      },
      include: {
        patientAccount: true,
      },
    })

    if (patient) {
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
    return
  }

  let integration = payload.messaging_profile_id
    ? await prisma.telnyxIntegration.findFirst({
        where: {
          messagingProfileId: payload.messaging_profile_id,
          isActive: true,
        },
        select: { practiceId: true, fromNumber: true },
      })
    : null

  if (!integration?.practiceId) {
    const integrations = await prisma.telnyxIntegration.findMany({
      where: { isActive: true },
      select: { practiceId: true, fromNumber: true },
    })
    integration =
      integrations.find((entry) =>
        toNumbers.some((toNumber) => phoneNumbersMatch(entry.fromNumber, toNumber))
      ) || null
  }

  if (!integration?.practiceId) {
    return
  }

  let patient = await prisma.patient.findFirst({
    where: {
      practiceId: integration.practiceId,
      deletedAt: null,
      OR: [
        { phone: { contains: normalizedFrom } },
        { primaryPhone: { contains: normalizedFrom } },
        { secondaryPhone: { contains: normalizedFrom } },
      ],
    },
    select: { id: true, phone: true, primaryPhone: true, secondaryPhone: true },
  })

  if (!patient) {
    const candidates = await prisma.patient.findMany({
      where: {
        practiceId: integration.practiceId,
        deletedAt: null,
      },
      select: { id: true, phone: true, primaryPhone: true, secondaryPhone: true },
      take: 500,
    })
    patient =
      candidates.find((candidate) => {
        const numbers = [candidate.phone, candidate.primaryPhone, candidate.secondaryPhone]
          .filter(Boolean)
          .map((num) => String(num).replace(/[^\d]/g, '').slice(-10))
        return numbers.includes(fromLast10)
      }) || null
  }

  if (!patient) {
    return
  }

  await logInboundCommunication({
    practiceId: integration.practiceId,
    patientId: patient.id,
    channel: 'sms',
    body: bodyText,
    metadata: {
      from,
      to: toNumbers[0],
      providerMessageId: payload.id,
      provider: 'telnyx',
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
