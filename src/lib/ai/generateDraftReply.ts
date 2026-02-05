import type { KnowledgeBaseMatch } from './knowledgeBase'

export type DraftConfidence = 'low' | 'medium' | 'high'

export interface DraftReplyContext {
  summary?: {
    latestPatientAsk: string
    whatHappened: string[]
    actionsTaken: string[]
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

function buildDraftBody(context: DraftReplyContext) {
  const latestAsk = context.summary?.latestPatientAsk
  const patientMessage = [...context.messages]
    .reverse()
    .find((message) => message.role === 'patient')?.body
  const kbTag = context.kbArticles[0]?.title ? `[KB: ${context.kbArticles[0].title}]` : ''

  const askLine = latestAsk && latestAsk !== 'No pending patient request'
    ? latestAsk.replace(/^Patient is asking about/i, 'You asked about')
    : patientMessage
      ? 'Thanks for the update on your request.'
      : 'Thanks for reaching out.'

  const secondLine = kbTag
    ? `Per ${kbTag}, we can help with the next steps and confirm details.`
    : 'We can help with the next steps and confirm details.'

  const thirdLine = 'Please let us know a preferred time or any constraints so we can assist.'

  return [askLine, secondLine, thirdLine].filter(Boolean).join(' ')
}

// LLM abstraction placeholder - replace with provider implementation.
export async function generateDraftReply(context: DraftReplyContext): Promise<DraftReplyResult> {
  const citations = context.kbArticles.map((article) => ({
    label: `[KB: ${article.title}]`,
    sourceId: article.id,
  }))

  const draftText = buildDraftBody(context)
  const confidence: DraftConfidence = context.kbArticles.length ? 'medium' : 'low'

  return {
    draftText,
    citations,
    confidence,
  }
}
