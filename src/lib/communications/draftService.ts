import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { generateDraftReply } from '@/lib/ai/generateDraftReply'
import { rewriteDraftReply, type RewriteMode } from '@/lib/ai/rewriteDraftReply'
import { retrieveKnowledgeBaseMatches } from '@/lib/ai/knowledgeBase'

const DEFAULT_MESSAGE_LIMIT = 10

const clinicalPatterns = [
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
  /urgent/i,
  /fever/i,
  /seizure/i,
  /pregnan/i,
]

export type DraftReplyResponse = {
  draftText: string
  citations: Array<{ label: string; sourceId: string }>
  confidence: 'low' | 'medium' | 'high'
  sources: {
    kb: Array<{ id: string; title: string; url?: string }>
    similar: Array<{ id: string; snippet: string }>
  }
}

function hasClinicalLanguage(messages: { body: string }[]) {
  return messages.some((message) => clinicalPatterns.some((pattern) => pattern.test(message.body)))
}

export async function buildDraftReply({
  practiceId,
  conversationId,
  actorUserId,
  messageLimit = DEFAULT_MESSAGE_LIMIT,
}: {
  practiceId: string
  conversationId: string
  actorUserId: string
  messageLimit?: number
}): Promise<{ result?: DraftReplyResponse; error?: 'clinical' | 'no_kb' }> {
  const messages = await prisma.communicationMessage.findMany({
    where: {
      practiceId,
      conversationId,
    },
    orderBy: { createdAt: 'desc' },
    take: messageLimit,
  })

  if (hasClinicalLanguage(messages)) {
    return { error: 'clinical' }
  }

  const summary = await prisma.communicationConversationSummary.findFirst({
    where: { conversationId },
  })

  const lastPatientMessage = messages.find((message) => message.direction === 'inbound')
  const kbMatches = await retrieveKnowledgeBaseMatches({
    query:
      summary?.latestPatientAsk ||
      lastPatientMessage?.body ||
      'patient request',
    limit: 3,
  })

  if (!kbMatches.length) {
    return { error: 'no_kb' }
  }

  const similarConversations = await prisma.communicationConversation.findMany({
    where: {
      practiceId,
      status: 'resolved',
      id: { not: conversationId },
    },
    select: {
      id: true,
      lastMessagePreview: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 3,
  })

  const result = await generateDraftReply({
    summary: summary
      ? {
          latestPatientAsk: summary.latestPatientAsk,
          whatHappened: summary.whatHappened.split('\n').filter(Boolean),
          actionsTaken: summary.actionsTaken.split('\n').filter(Boolean),
        }
      : undefined,
    messages: messages
      .slice()
      .reverse()
      .map((message) => ({
        role:
          message.direction === 'inbound'
            ? 'patient'
            : message.direction === 'outbound'
              ? 'staff'
              : 'system',
        body: message.body,
      })),
    kbArticles: kbMatches,
    similarConversations: similarConversations.map((item) => ({
      id: item.id,
      snippet: item.lastMessagePreview || '',
    })),
  })

  const stored = await prisma.communicationDraftReply.upsert({
    where: { conversationId },
    create: {
      conversationId,
      draftText: result.draftText,
      citations: {
        citations: result.citations,
        sources: {
          kb: kbMatches.map((match) => ({
            id: match.id,
            title: match.title,
            url: match.url,
          })),
          similar: similarConversations.map((item) => ({
            id: item.id,
            snippet: item.lastMessagePreview || '',
          })),
        },
      } as Prisma.InputJsonValue,
      confidence: result.confidence,
    },
    update: {
      draftText: result.draftText,
      citations: {
        citations: result.citations,
        sources: {
          kb: kbMatches.map((match) => ({
            id: match.id,
            title: match.title,
            url: match.url,
          })),
          similar: similarConversations.map((item) => ({
            id: item.id,
            snippet: item.lastMessagePreview || '',
          })),
        },
      } as Prisma.InputJsonValue,
      confidence: result.confidence,
    },
  })

  await prisma.auditLog.create({
    data: {
      practiceId,
      userId: actorUserId,
      action: 'ai.draft.generated',
      resourceType: 'conversation',
      resourceId: conversationId,
      changes: {
        draftId: stored.id,
        confidence: stored.confidence,
      } as Prisma.InputJsonValue,
    },
  })

  return {
    result: {
      draftText: stored.draftText,
      citations: result.citations,
      confidence: stored.confidence as 'low' | 'medium' | 'high',
      sources: {
        kb: kbMatches.map((match) => ({ id: match.id, title: match.title, url: match.url })),
        similar: similarConversations.map((item) => ({ id: item.id, snippet: item.lastMessagePreview || '' })),
      },
    },
  }
}

export async function rewriteDraft({
  practiceId,
  conversationId,
  actorUserId,
  mode,
}: {
  practiceId: string
  conversationId: string
  actorUserId: string
  mode: RewriteMode
}): Promise<DraftReplyResponse | null> {
  const existing = await prisma.communicationDraftReply.findFirst({
    where: {
      conversationId,
      conversation: {
        practiceId,
      },
    },
  })

  if (!existing) return null
  const storedMeta = (existing.citations || {}) as {
    citations?: Array<{ label: string; sourceId: string }>
    sources?: { kb?: Array<{ id: string; title: string; url?: string }>; similar?: Array<{ id: string; snippet: string }> }
  }

  const rewritten = await rewriteDraftReply(existing.draftText, mode)

  const updated = await prisma.communicationDraftReply.update({
    where: { conversationId },
    data: {
      draftText: rewritten.draftText,
      confidence: rewritten.confidence,
    },
  })

  await prisma.auditLog.create({
    data: {
      practiceId,
      userId: actorUserId,
      action: 'ai.draft.rewritten',
      resourceType: 'conversation',
      resourceId: conversationId,
      changes: {
        draftId: updated.id,
        mode,
      } as Prisma.InputJsonValue,
    },
  })

  return {
    draftText: updated.draftText,
    citations: storedMeta.citations || [],
    confidence: updated.confidence as 'low' | 'medium' | 'high',
    sources: {
      kb: storedMeta.sources?.kb || [],
      similar: storedMeta.sources?.similar || [],
    },
  }
}
