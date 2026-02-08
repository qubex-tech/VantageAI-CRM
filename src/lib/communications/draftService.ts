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

function findOutstandingInbound(messagesDesc: Array<{ id: string; direction: string; body: string }>) {
  let seenOutbound = false
  for (const message of messagesDesc) {
    if (message.direction === 'outbound') {
      seenOutbound = true
      continue
    }
    if (message.direction === 'inbound' && !seenOutbound) {
      return message
    }
  }
  return messagesDesc.find((message) => message.direction === 'inbound')
}

function extractEducationFacts(matches: Array<{ snippet?: string; summary?: string }>) {
  const keywords = [
    'internship',
    'residency',
    'fellowship',
    'board certified',
    'mba',
    'university',
    'clinic',
    'hospital',
  ]
  const facts = new Set<string>()
  matches.forEach((match) => {
    const source = match.summary || match.snippet || ''
    source
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const lower = line.toLowerCase()
        if (keywords.some((keyword) => lower.includes(keyword))) {
          facts.add(line)
        }
      })
  })
  return Array.from(facts).slice(0, 6)
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
}): Promise<{ result?: DraftReplyResponse; error?: 'clinical' }> {
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

  const outstandingQuestion = findOutstandingInbound(messages)
  const lastPatientMessage = messages.find((message) => message.direction === 'inbound')
  const focusMessage = outstandingQuestion || lastPatientMessage
  const intent = await import('@/lib/ai/classifyIntent').then(({ classifyIntent }) =>
    classifyIntent(focusMessage?.body || '')
  )
  const fallbackKbSignal = /medicare|medicaid|insurance|copay|billing|payment|coverage|doctor|provider|dr\.|education|training|fellowship|residency|board certified|do you treat|treat(?:ment)?|conditions?|services?|offer/i.test(
    focusMessage?.body || ''
  )

  const conversation = await prisma.communicationConversation.findFirst({
    where: { id: conversationId, practiceId },
    select: {
      id: true,
      patient: {
        select: {
          id: true,
          name: true,
          preferredName: true,
          primaryPhone: true,
          phone: true,
          email: true,
        },
      },
    },
  })

  const nextAppointment = await prisma.appointment.findFirst({
    where: {
      practiceId,
      patientId: conversation?.patient.id,
      startTime: { gte: new Date() },
      status: { in: ['scheduled', 'confirmed'] },
    },
    orderBy: { startTime: 'asc' },
    select: { startTime: true, visitType: true },
  })

  const needsKb =
    intent.sources.includes('kb') ||
    intent.sources.includes('both') ||
    intent.label === 'insurance_coverage' ||
    intent.label === 'billing_payment' ||
    intent.label === 'practice_provider' ||
    fallbackKbSignal
  const needsPatient =
    intent.sources.includes('patient') ||
    intent.sources.includes('both') ||
    intent.label === 'appointment_scheduling'

  const kbMatches = needsKb
    ? await retrieveKnowledgeBaseMatches({
        practiceId,
        query:
          focusMessage?.body ||
          summary?.latestPatientAsk ||
          'patient request',
        limit: 3,
        fallbackToRecent: true,
      })
    : []
  const educationFacts = extractEducationFacts(kbMatches)

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

  const messagesAsc = messages.slice().reverse()
  const focusIndex = outstandingQuestion
    ? messagesAsc.findIndex((message) => message.id === outstandingQuestion.id)
    : -1
  const focusedMessages = focusIndex >= 0 ? messagesAsc.slice(focusIndex) : messagesAsc

  const result = await generateDraftReply({
    summary: summary
      ? {
          latestPatientAsk: summary.latestPatientAsk,
          whatHappened: summary.whatHappened.split('\n').filter(Boolean),
          actionsTaken: summary.actionsTaken.split('\n').filter(Boolean),
        }
      : undefined,
    currentQuestion: focusMessage?.body || '',
    providerEducation: educationFacts,
    messages: focusedMessages.map((message) => ({
        role:
          message.direction === 'inbound'
            ? 'patient'
            : message.direction === 'outbound'
              ? 'staff'
              : 'system',
        body: message.body,
      })),
    patient: needsPatient && conversation
      ? {
          name: conversation.patient.preferredName || conversation.patient.name,
          email: conversation.patient.email || undefined,
          phone: conversation.patient.primaryPhone || conversation.patient.phone || undefined,
        }
      : undefined,
    nextAppointment: needsPatient && nextAppointment
      ? {
          startTime: nextAppointment.startTime,
          visitType: nextAppointment.visitType || undefined,
        }
      : undefined,
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
  prompt,
}: {
  practiceId: string
  conversationId: string
  actorUserId: string
  mode?: RewriteMode
  prompt?: string
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

  const rewritten = await rewriteDraftReply(existing.draftText, mode, prompt)

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
        mode: mode || 'custom',
        prompt: prompt || undefined,
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
