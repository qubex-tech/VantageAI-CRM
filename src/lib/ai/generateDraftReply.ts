import OpenAI from 'openai'
import type { KnowledgeBaseMatch } from './knowledgeBase'

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

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SYSTEM_PROMPT = `You are a healthcare CRM drafting assistant. Generate a concise, non-clinical reply draft for front-desk staff.
Rules:
- 2–4 sentences max. No clinical advice.
- Use plain, empathetic, operational language.
- Use ONLY provided context; do not invent facts.
- Include inline citations for KB sources you use, formatted like [KB: Title].
- If no KB sources are applicable, return citations as an empty array and do NOT invent KB labels.
- If the patient asks who the doctor/provider is, acknowledge and offer to share provider details or connect them.
- If an appointment time is provided, confirm it.
Return JSON ONLY in this format:
{"draft_text":"...", "citations":[{"label":"[KB: ...]","sourceId":"..."}], "confidence":"low|medium|high"}`

function buildContext(context: DraftReplyContext) {
  return {
    summary: context.summary,
    patient: context.patient,
    nextAppointment: context.nextAppointment
      ? {
          startTime: context.nextAppointment.startTime.toISOString(),
          visitType: context.nextAppointment.visitType,
        }
      : null,
    messages: context.messages.slice(-10),
    knowledgeBase: context.kbArticles.map((article) => ({
      id: article.id,
      title: article.title,
      url: article.url,
      snippet: article.snippet,
    })),
    similarConversations: context.similarConversations,
  }
}

// LLM abstraction placeholder - replace with provider implementation.
export async function generateDraftReply(context: DraftReplyContext): Promise<DraftReplyResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      draftText: 'Thanks for reaching out. We can help with the next steps and confirm details.',
      citations: [],
      confidence: 'low',
    }
  }

  const openai = getOpenAIClient()
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(buildContext(context)) },
    ],
  })

  const raw = completion.choices[0]?.message?.content?.trim() || ''
  try {
    const parsed = JSON.parse(raw) as DraftReplyResult
    return {
      draftText: parsed.draftText,
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      confidence: parsed.confidence || 'low',
    }
  } catch {
    return {
      draftText: 'Thanks for reaching out. We can help with the next steps and confirm details.',
      citations: [],
      confidence: 'low',
    }
  }
}
