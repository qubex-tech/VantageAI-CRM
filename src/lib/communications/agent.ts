import { prisma } from '@/lib/db'
import type { CommunicationChannel } from './types'
import { recordCommunicationAudit } from './audit'

export interface IntentResult {
  intent: 'reschedule' | 'billing_question' | 'general' | 'unknown'
  confidence: number
}

const rescheduleKeywords = ['reschedule', 'move appointment', 'change time', 'change date']
const billingKeywords = ['bill', 'billing', 'invoice', 'charge', 'payment', 'balance', 'refund']

export function classifyIntent(message: string): IntentResult {
  const text = message.toLowerCase()

  if (rescheduleKeywords.some((keyword) => text.includes(keyword))) {
    return { intent: 'reschedule', confidence: 0.82 }
  }

  if (billingKeywords.some((keyword) => text.includes(keyword))) {
    return { intent: 'billing_question', confidence: 0.78 }
  }

  if (text.length > 12) {
    return { intent: 'general', confidence: 0.55 }
  }

  return { intent: 'unknown', confidence: 0.35 }
}

export async function handleInboundAgent({
  practiceId,
  userId,
  conversationId,
  patientId,
  messageId,
  channel,
  body,
}: {
  practiceId: string
  userId: string
  conversationId: string
  patientId: string
  messageId: string
  channel: CommunicationChannel
  body: string
}) {
  const intent = classifyIntent(body)

  await prisma.communicationMessage.update({
    where: { id: messageId },
    data: {
      intent: intent.intent,
      intentConfidence: intent.confidence,
    },
  })

  if (intent.confidence < 0.6) {
    await prisma.communicationAssignment.create({
      data: {
        practiceId,
        conversationId,
        status: 'pending',
        assignedByUserId: userId,
      },
    })

    await recordCommunicationAudit({
      practiceId,
      userId,
      action: 'assign',
      resourceType: 'conversation',
      resourceId: conversationId,
      metadata: {
        reason: 'agent_low_confidence',
        channel,
      },
    })

    return
  }

  if (intent.intent === 'reschedule' || intent.intent === 'billing_question') {
    const noteBody =
      intent.intent === 'reschedule'
        ? 'Suggested next step: offer available appointment windows and confirm preferred time.'
        : 'Suggested next step: review the latest statement and offer to explain charges or take payment.'

    const note = await prisma.communicationMessage.create({
      data: {
        practiceId,
        conversationId,
        patientId,
        authorUserId: userId,
        direction: 'internal',
        type: 'note',
        body: noteBody,
        channel,
        deliveryStatus: 'sent',
        metadata: {
          agentSuggested: true,
          intent: intent.intent,
        },
      },
    })

    await recordCommunicationAudit({
      practiceId,
      userId,
      action: 'note',
      resourceType: 'conversation',
      resourceId: conversationId,
      metadata: {
        noteId: note.id,
        intent: intent.intent,
      },
    })
  }
}
