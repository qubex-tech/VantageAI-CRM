import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { summarizeConversation } from '@/lib/ai/summarizeConversation'

const DEFAULT_MESSAGE_LIMIT = 20

const urgentPatterns = [
  /chest pain/i,
  /shortness of breath/i,
  /can'?t breathe/i,
  /severe pain/i,
  /bleeding/i,
  /stroke/i,
  /heart attack/i,
  /suicid/i,
  /overdose/i,
  /allergic reaction/i,
  /anaphylaxis/i,
  /emergency/i,
]

type SummaryOutput = {
  id: string
  conversationId: string
  whatHappened: string[]
  latestPatientAsk: string
  actionsTaken: string[]
  confidence: 'low' | 'medium' | 'high'
  lastGeneratedAt: Date
}

type SummaryServiceResult = {
  summary: SummaryOutput | null
  needsReview: boolean
}

function detectNeedsReview(messages: { body: string }[]) {
  return messages.some((message) => urgentPatterns.some((pattern) => pattern.test(message.body)))
}

function splitBullets(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function mapSummary(summary: {
  id: string
  conversationId: string
  whatHappened: string
  latestPatientAsk: string
  actionsTaken: string
  confidence: string
  lastGeneratedAt: Date
}) {
  return {
    id: summary.id,
    conversationId: summary.conversationId,
    whatHappened: splitBullets(summary.whatHappened),
    latestPatientAsk: summary.latestPatientAsk,
    actionsTaken: splitBullets(summary.actionsTaken),
    confidence: summary.confidence as 'low' | 'medium' | 'high',
    lastGeneratedAt: summary.lastGeneratedAt,
  }
}

export async function getConversationSummary({
  practiceId,
  conversationId,
  messageLimit = DEFAULT_MESSAGE_LIMIT,
}: {
  practiceId: string
  conversationId: string
  messageLimit?: number
}): Promise<SummaryServiceResult> {
  const summary = await prisma.communicationConversationSummary.findFirst({
    where: {
      conversationId,
      conversation: {
        practiceId,
      },
    },
  })

  if (!summary) {
    return { summary: null, needsReview: false }
  }

  const messages = await prisma.communicationMessage.findMany({
    where: {
      practiceId,
      conversationId,
    },
    select: { body: true },
    orderBy: { createdAt: 'desc' },
    take: messageLimit,
  })

  return {
    summary: mapSummary(summary),
    needsReview: detectNeedsReview(messages),
  }
}

export async function generateConversationSummary({
  practiceId,
  conversationId,
  messageLimit = DEFAULT_MESSAGE_LIMIT,
  actorUserId,
}: {
  practiceId: string
  conversationId: string
  messageLimit?: number
  actorUserId?: string
}): Promise<SummaryServiceResult> {
  const messages = await prisma.communicationMessage.findMany({
    where: {
      practiceId,
      conversationId,
    },
    orderBy: { createdAt: 'desc' },
    take: messageLimit,
  })

  const chronological = [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const summary = await summarizeConversation(
    chronological.map((message) => ({
      role:
        message.direction === 'inbound'
          ? 'patient'
          : message.direction === 'outbound'
            ? 'staff'
            : 'system',
      body: message.body,
      isInternal: message.type === 'note' || message.direction === 'internal',
      createdAt: message.createdAt,
    }))
  )

  const stored = await prisma.communicationConversationSummary.upsert({
    where: {
      conversationId,
    },
    create: {
      conversationId,
      whatHappened: summary.whatHappened.join('\n'),
      latestPatientAsk: summary.latestPatientAsk,
      actionsTaken: summary.actionsTaken.join('\n'),
      confidence: summary.confidence,
      lastGeneratedAt: new Date(),
    },
    update: {
      whatHappened: summary.whatHappened.join('\n'),
      latestPatientAsk: summary.latestPatientAsk,
      actionsTaken: summary.actionsTaken.join('\n'),
      confidence: summary.confidence,
      lastGeneratedAt: new Date(),
    },
  })

  const resolvedActor =
    actorUserId ||
    (
      await prisma.communicationAssignment.findFirst({
        where: {
          practiceId,
          conversationId,
          status: 'active',
          assignedUserId: { not: null },
        },
        orderBy: { assignedAt: 'desc' },
        select: { assignedUserId: true },
      })
    )?.assignedUserId

  if (resolvedActor) {
    await prisma.auditLog.create({
      data: {
        practiceId,
        userId: resolvedActor,
        action: 'conversation.summary.generated',
        resourceType: 'conversation',
        resourceId: conversationId,
        changes: {
          summaryId: stored.id,
          confidence: stored.confidence,
        } as Prisma.InputJsonValue,
      },
    })
  }

  return {
    summary: mapSummary(stored),
    needsReview: detectNeedsReview(messages),
  }
}
