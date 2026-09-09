import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logInboundCommunication } from '@/lib/communications/logging'
import { resolveInboundSmsPatientForPracticeIds } from '@/lib/telnyx-inbound'
import { handleSlotFillInboundSms } from '@/lib/appointment-optimization/slotFillInboundReply'
import {
  APIDAZE_EMPTY_SCRIPT_XML,
  findMatchingApidazeIntegrations,
  isApidazeWebhookAuthorized,
  parseApidazeInboundParams,
} from '@/lib/apidaze'

export const dynamic = 'force-dynamic'

function xmlResponse(status = 200) {
  return new NextResponse(APIDAZE_EMPTY_SCRIPT_XML, {
    status,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}

function collectParamsFromSearch(searchParams: URLSearchParams): Record<string, string> {
  const source: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    source[key] = value
  })
  return source
}

async function collectParamsFromRequest(req: NextRequest): Promise<Record<string, string>> {
  const source = collectParamsFromSearch(req.nextUrl.searchParams)
  const contentType = req.headers.get('content-type') || ''

  if (req.method === 'GET') {
    return source
  }

  try {
    if (contentType.includes('application/json')) {
      const json = (await req.json()) as Record<string, unknown>
      for (const [key, value] of Object.entries(json)) {
        if (typeof value === 'string' && value.trim()) {
          source[key] = value
        }
      }
      return source
    }

    const form = await req.formData()
    form.forEach((value, key) => {
      if (typeof value === 'string' && value.trim()) {
        source[key] = value
      }
    })
  } catch (error) {
    console.warn('[Apidaze webhook] Failed to parse request body', error)
  }

  return source
}

async function handleInbound(req: NextRequest) {
  const providedSecret =
    req.nextUrl.searchParams.get('secret') || req.nextUrl.searchParams.get('webhook_secret')
  if (!isApidazeWebhookAuthorized(providedSecret)) {
    console.error('[Apidaze webhook] Unauthorized request')
    return xmlResponse(403)
  }

  const source = await collectParamsFromRequest(req)
  const inbound = parseApidazeInboundParams(source)

  if (!inbound.body || !inbound.from || !inbound.to) {
    console.warn('[Apidaze webhook] Skipping inbound message with missing text, from, or to', {
      hasText: Boolean(inbound.body),
      from: inbound.from,
      to: inbound.to,
    })
    return xmlResponse()
  }

  const matches = await findMatchingApidazeIntegrations([inbound.to])
  if (matches.length === 0) {
    console.warn('[Apidaze webhook] No active Apidaze integration matched inbound message', {
      from: inbound.from,
      to: inbound.to,
    })
    return xmlResponse()
  }

  const inboundContext = await resolveInboundSmsPatientForPracticeIds({
    from: inbound.from,
    practiceIds: matches.map((entry) => entry.practiceId),
  })

  if (!inboundContext) {
    return xmlResponse()
  }

  const { patient, integrationPracticeIds, resolution } = inboundContext
  const bodyText = inbound.body

  if (bodyText.toUpperCase() === 'STOP') {
    if (!patient) {
      console.warn('[Apidaze webhook] STOP received but patient not found for', inbound.from)
      return xmlResponse()
    }
    await handleStopOptOut(patient, inbound.from, req)
    return xmlResponse()
  }

  if (!patient) {
    console.warn('[Apidaze webhook] Inbound SMS patient not matched', {
      from: inbound.from,
      apidazePracticeIds: integrationPracticeIds,
      to: inbound.to,
    })
    return xmlResponse()
  }

  await logInboundCommunication({
    practiceId: patient.practiceId,
    patientId: patient.id,
    channel: 'sms',
    body: bodyText,
    metadata: {
      from: inbound.from,
      to: inbound.to,
      providerMessageId: inbound.uuid,
      provider: 'apidaze',
      apidazeIntegrationPracticeIds: integrationPracticeIds,
    },
  })

  try {
    const slotFillResult = await handleSlotFillInboundSms({
      practiceId: patient.practiceId,
      patientId: patient.id,
      body: bodyText,
      replyFrom: inbound.from,
    })
    if (slotFillResult.handled) {
      console.info('[SlotFill] inbound SMS handled', {
        practiceId: patient.practiceId,
        patientId: patient.id,
        resolution,
        action: slotFillResult.action,
        reason: slotFillResult.reason,
        provider: 'apidaze',
      })
    }
  } catch (error) {
    console.error('[SlotFill] inbound SMS handler failed', error)
  }

  return xmlResponse()
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

export async function GET(req: NextRequest) {
  try {
    return await handleInbound(req)
  } catch (error) {
    console.error('[Apidaze webhook] Unexpected error:', error)
    return xmlResponse()
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handleInbound(req)
  } catch (error) {
    console.error('[Apidaze webhook] Unexpected error:', error)
    return xmlResponse()
  }
}
