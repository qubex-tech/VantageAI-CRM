/**
 * RetellAI Webhook Handlers
 * 
 * Processes webhook events from RetellAI voice agents
 */

import { prisma } from './db'
import { findOrCreatePatientByPhone, getAvailableSlots, bookAppointment, cancelAppointment } from './agentActions'
import { redactPHI } from './phi'
import { createAuditLog } from './audit'

export interface RetellWebhookEvent {
  event: string
  call?: {
    call_id?: string
    phone_number?: string
    direction?: string
  }
  transcript?: {
    content?: string
  }
  tool_calls?: Array<{
    tool_name: string
    parameters: any
  }>
}

/**
 * Process RetellAI webhook event
 */
export async function processRetellWebhook(
  practiceId: string,
  event: RetellWebhookEvent
): Promise<any> {
  const { event: eventType, call, transcript, tool_calls } = event

  // Log the conversation
  const callerPhone = call?.phone_number || 'unknown'

  // Find or create conversation record
  let conversation = await prisma.voiceConversation.findFirst({
    where: {
      practiceId,
      retellCallId: call?.call_id,
    },
  })

  if (!conversation && call?.call_id) {
    conversation = await prisma.voiceConversation.create({
      data: {
        practiceId,
        callerPhone,
        retellCallId: call.call_id,
        startedAt: new Date(),
        transcript: transcript?.content ? redactPHI(transcript.content) : undefined,
      },
    })
  } else if (conversation && transcript?.content) {
    conversation = await prisma.voiceConversation.update({
      where: { id: conversation.id },
      data: {
        transcript: redactPHI(transcript.content),
        updatedAt: new Date(),
      },
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

  // Handle call end - emit Inngest event for real-time post-call processing (no login required)
  if (eventType === 'call_ended' && call?.call_id) {
    if (conversation) {
      await prisma.voiceConversation.update({
        where: { id: conversation.id },
        data: {
          endedAt: new Date(),
        },
      })
    }

    // Emit Inngest event for full call data processing (fetch via RetellAPI, extract patient data)
    try {
      const { inngest } = await import('@/inngest/client')
      await inngest.send({
        name: 'retell/call.ended',
        data: {
          practiceId,
          callId: call.call_id,
        },
      })
    } catch (err) {
      console.error('[RetellAI] Failed to emit call_ended Inngest event:', err)
      // Don't fail the webhook - processing will happen when user visits Calls page
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

