import type { KnowledgeBaseMatch } from './knowledgeBase'
import { classifyIntent } from './classifyIntent'

export type DraftConfidence = 'low' | 'medium' | 'high'

export interface DraftReplyContext {
  summary?: {
    latestPatientAsk: string
    whatHappened: string[]
    actionsTaken: string[]
  }
  patient?: {
    name: string
    email?: string
    phone?: string
  }
  nextAppointment?: {
    startTime: Date
    visitType?: string
  }
  messages: Array<{ role: 'patient' | 'staff' | 'agent' | 'system'; body: string }>
  kbArticles: KnowledgeBaseMatch[]
  similarConversations: Array<{ id: string; snippet: string }>
}

export interface DraftReplyResult {
  draftText: string
  citations: Array<{ label: string; sourceId: string }>
  confidence: DraftConfidence
}

async function detectProviderIntent(text: string) {
  const intent = await classifyIntent(text)
  return intent.label === 'practice_provider'
}

async function buildDraftBody(context: DraftReplyContext) {
  const latestAsk = context.summary?.latestPatientAsk
  const patientMessage = [...context.messages]
    .reverse()
    .find((message) => message.role === 'patient')?.body
  const kbTag = context.kbArticles[0]?.title ? `[KB: ${context.kbArticles[0].title}]` : ''
  const patientName = context.patient?.name || 'there'
  const appointment = context.nextAppointment
  const appointmentLine = appointment
    ? `We have you scheduled for ${appointment.visitType ? `${appointment.visitType} ` : ''}on ${appointment.startTime.toLocaleDateString()}.`
    : ''

  const hasClearAsk =
    Boolean(latestAsk) &&
    latestAsk !== 'No pending patient request' &&
    !/no clear request/i.test(latestAsk || '')

  const askLine = hasClearAsk
    ? latestAsk.replace(/^Patient is asking about/i, 'You asked about')
    : patientMessage
      ? `Thanks ${patientName}—we’re looking into this.`
      : `Thanks for reaching out, ${patientName}.`

  const secondLine = kbTag
    ? `Per ${kbTag}, we can help with the next steps and confirm details.`
    : 'We can help with the next steps and confirm details.'

  const isProviderQuestion = patientMessage ? await detectProviderIntent(patientMessage) : false
  const thirdLine =
    appointmentLine ||
    (isProviderQuestion
      ? 'We can share our provider details—let us know if you are looking for a specific doctor.'
      : 'Please let us know a preferred time or any constraints so we can assist.')

  return [askLine, secondLine, thirdLine].filter(Boolean).join(' ')
}

// LLM abstraction placeholder - replace with provider implementation.
export async function generateDraftReply(context: DraftReplyContext): Promise<DraftReplyResult> {
  const citations = context.kbArticles.map((article) => ({
    label: `[KB: ${article.title}]`,
    sourceId: article.id,
  }))

  const draftText = await buildDraftBody(context)
  const confidence: DraftConfidence = context.kbArticles.length ? 'medium' : 'low'

  return {
    draftText,
    citations,
    confidence,
  }
}
