/**
 * RetellAI Webhook Handlers
 * 
 * Processes webhook events from RetellAI voice agents
 */

import { prisma } from './db'
import { findOrCreatePatientByPhone, getAvailableSlots, bookAppointment, cancelAppointment } from './agentActions'
import { redactPHI } from './phi'
import { createAuditLog } from './audit'
import type { Prisma } from '@prisma/client'
import {
  isCurogramEscalationEnabled,
  normalizePhoneToE164,
  resolveCurogramIntentTopic,
  sendCurogramEscalation,
} from './curogram'

/**
 * RetellAI webhook payload - matches https://docs.retellai.com/features/webhook-overview
 * call_ended: call object excludes call_analysis
 * call_analyzed: call object includes full call_analysis
 */
export interface RetellWebhookEvent {
  event: string
  call?: {
    call_id?: string
    call_type?: string
    from_number?: string
    to_number?: string
    direction?: 'inbound' | 'outbound'
    transcript?: string
    transcript_object?: any[]
    transcript_with_tool_calls?: any[]
    start_timestamp?: number
    end_timestamp?: number
    call_analysis?: any
    metadata?: Record<string, any>
    retell_llm_dynamic_variables?: Record<string, any>
    [key: string]: any
  }
  /** Legacy / alternate: some webhooks may send transcript at top level */
  transcript?: { content?: string }
  tool_calls?: Array<{ tool_name: string; parameters: any }>
}

/**
 * Process RetellAI webhook event
 */
export async function processRetellWebhook(
  practiceId: string,
  event: RetellWebhookEvent
): Promise<any> {
  const { event: eventType, call, transcript, tool_calls } = event
  const callId = call?.call_id
  const requestId = `retell-curogram-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // Caller phone: RetellAI uses from_number (inbound) / to_number (outbound) per docs
  const callerPhone =
    call?.from_number || call?.to_number || call?.phone_number || 'unknown'

  // Transcript: RetellAI puts it at call.transcript (string), not event.transcript.content
  const transcriptText = call?.transcript ?? transcript?.content

  // Find or create conversation record
  let conversation = await prisma.voiceConversation.findFirst({
    where: {
      practiceId,
      retellCallId: callId,
    },
  })

  if (!conversation && callId) {
    conversation = await prisma.voiceConversation.create({
      data: {
        practiceId,
        callerPhone,
        retellCallId: callId,
        startedAt: call?.start_timestamp ? new Date(call.start_timestamp) : new Date(),
        transcript: transcriptText ? redactPHI(transcriptText) : undefined,
      },
    })
  } else if (conversation && transcriptText) {
    conversation = await prisma.voiceConversation.update({
      where: { id: conversation.id },
      data: {
        transcript: redactPHI(transcriptText),
        endedAt: call?.end_timestamp ? new Date(call.end_timestamp) : undefined,
        updatedAt: new Date(),
      },
    })
  }

  // Trigger Curogram escalation-to-text once per call.
  const retellIntegration = await prisma.retellIntegration.findUnique({
    where: { practiceId },
    select: {
      curogramEscalationEnabled: true,
      curogramEscalationUrl: true,
    },
  })
  const curogramEscalationEnabled = isCurogramEscalationEnabled({
    enabled: Boolean(retellIntegration?.curogramEscalationEnabled),
    endpointUrl: retellIntegration?.curogramEscalationUrl,
  })

  if (conversation && callId && curogramEscalationEnabled) {
    const metadata = (conversation.metadata || {}) as Record<string, unknown>
    const alreadySent = Boolean(metadata.curogramEscalationSentAt)
    const shouldAttemptEscalation =
      !alreadySent &&
      (eventType === 'call_started' || eventType === 'call_analyzed' || eventType === 'call_ended')

    if (shouldAttemptEscalation) {
      const normalizedCallerNumber = normalizePhoneToE164(callerPhone)
      if (normalizedCallerNumber) {
        const callAnalysis = (call?.call_analysis || {}) as Record<string, unknown>
        const customAnalysis = (callAnalysis.custom_analysis_data || {}) as Record<string, unknown>
        const metadataFromCall = (call?.metadata || {}) as Record<string, unknown>

        const intentTopic = resolveCurogramIntentTopic({
          callReason:
            (customAnalysis.call_reason as string | undefined) ||
            (callAnalysis.call_reason as string | undefined) ||
            (metadataFromCall.call_reason as string | undefined),
          callSummary:
            (callAnalysis.call_summary as string | undefined) ||
            (customAnalysis.call_summary as string | undefined),
          defaultIntent: process.env.CUROGRAM_AI_ESCALATION_DEFAULT_INTENT || 'AI call escalation',
        })

        console.log('[Curogram Escalation] Sending', {
          requestId,
          practiceId,
          callId,
          eventType,
          callerNumber: normalizedCallerNumber,
          hasIntentTopic: Boolean(intentTopic),
        })

        const escalationResult = await sendCurogramEscalation({
          callerNumber: normalizedCallerNumber,
          intentTopic,
        }, {
          endpointUrl: retellIntegration?.curogramEscalationUrl,
          requestId,
          callId,
        })

        console.log('[Curogram Escalation] Result', {
          requestId,
          practiceId,
          callId,
          ok: escalationResult.ok,
          status: escalationResult.status,
          responsePreview: escalationResult.body.slice(0, 200),
        })

        const escalationMeta = {
          ...metadata,
          curogramEscalationAttemptedAt: new Date().toISOString(),
          curogramEscalationSentAt: null as string | null,
          curogramEscalationStatus: escalationResult.status,
          curogramEscalationResponse: escalationResult.body.slice(0, 500),
          curogramEscalationCallerNumber: normalizedCallerNumber,
          curogramEscalationIntentTopic: intentTopic || null,
          curogramEscalationRequestId: requestId,
          curogramEscalationEventType: eventType,
        }

        if (escalationResult.ok) {
          escalationMeta.curogramEscalationSentAt = new Date().toISOString()
        }

        conversation = await prisma.voiceConversation.update({
          where: { id: conversation.id },
          data: {
            metadata: escalationMeta as Prisma.InputJsonObject,
          },
        })
      } else {
        console.warn('[Curogram Escalation] Skipped: invalid caller number', {
          requestId,
          practiceId,
          callId,
          callerPhone,
        })

        await prisma.voiceConversation.update({
          where: { id: conversation.id },
          data: {
            metadata: {
              ...metadata,
              curogramEscalationAttemptedAt: new Date().toISOString(),
              curogramEscalationError: 'Missing valid callerNumber for Curogram payload',
              curogramEscalationRequestId: requestId,
              curogramEscalationEventType: eventType,
            } as Prisma.InputJsonObject,
          },
        })
      }
    }
  } else if (
    conversation &&
    callId &&
    retellIntegration?.curogramEscalationEnabled &&
    !retellIntegration?.curogramEscalationUrl?.trim()
  ) {
    console.warn('[Curogram Escalation] Skipped: setting enabled without URL', {
      requestId,
      practiceId,
      callId,
    })
  }

  // Handle tool calls
  if (tool_calls && tool_calls.length > 0) {
    const results = []

    for (const toolCall of tool_calls) {
      try {
        const result = await handleToolCall(practiceId, toolCall.tool_name, toolCall.parameters)
        results.push({
          tool_name: toolCall.tool_name,
          result,
        })
      } catch (error) {
        console.error(`Error handling tool call ${toolCall.tool_name}:`, error)
        results.push({
          tool_name: toolCall.tool_name,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return { tool_results: results }
  }

  // Handle call end / call analyzed - emit Inngest for real-time post-call processing (no login required)
  const shouldEmitInngest =
    (eventType === 'call_ended' || eventType === 'call_analyzed') && call?.call_id

  if (shouldEmitInngest) {
    if (conversation) {
      await prisma.voiceConversation.update({
        where: { id: conversation.id },
        data: {
          endedAt: call?.end_timestamp ? new Date(call.end_timestamp) : new Date(),
          transcript: transcriptText ? redactPHI(transcriptText) : undefined,
        },
      })
    }

    // call_analyzed has full call_analysis in payload - pass it to avoid API fetch
    // call_ended does not have call_analysis - Inngest will fetch via API after delay
    try {
      const { inngest } = await import('@/inngest/client')
      await inngest.send({
        name: 'retell/call.ended',
        data: {
          practiceId,
          callId: call.call_id,
          eventType,
          call: eventType === 'call_analyzed' ? call : undefined,
        },
      })
    } catch (err) {
      console.error('[RetellAI] Failed to emit Inngest event:', err)
    }
  }

  return { status: 'ok' }
}

/**
 * Handle individual tool calls from RetellAI
 */
async function handleToolCall(
  practiceId: string,
  toolName: string,
  parameters: any
): Promise<any> {
  switch (toolName) {
    case 'find_or_create_patient':
      return await findOrCreatePatientByPhone(
        practiceId,
        parameters.phone,
        {
          name: parameters.name,
          dateOfBirth: parameters.dateOfBirth,
          email: parameters.email,
        }
      )

    case 'get_available_slots':
      return await getAvailableSlots(
        practiceId,
        parameters.eventTypeId,
        parameters.dateFrom,
        parameters.dateTo,
        parameters.timezone || 'America/New_York'
      )

    case 'book_appointment':
      return await bookAppointment(
        practiceId,
        parameters.patientId,
        parameters.eventTypeId,
        parameters.startTime,
        parameters.timezone || 'America/New_York',
        parameters.reason
      )

    case 'cancel_appointment':
      return await cancelAppointment(practiceId, parameters.appointmentId)

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

