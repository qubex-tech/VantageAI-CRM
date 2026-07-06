import OpenAI from 'openai'
import type { SlotFillReplyIntent } from '@/lib/appointment-optimization/types'

export type SlotFillReplyClassification = {
  intent: SlotFillReplyIntent
  confidence: 'low' | 'medium' | 'high'
  method: 'keyword' | 'llm' | 'fallback'
}

export type SlotFillReplyContext = {
  /** No PHI — e.g. "Tuesday, Jul 7 at 9:30 AM" */
  offeredSlotDescription: string
  /** No PHI — patient's current visit window, if known */
  currentAppointmentDescription?: string
}

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const ACCEPT_PATTERN =
  /^\s*(yes|y|yeah|yep|sure|ok|okay|accept|confirmed|confirm|i('?d|\s)?( like| take)?( it| that)?)\s*[.!?]*\s*$/i

const DECLINE_PATTERN =
  /^\s*(no|n|nope|nah|decline|pass|not interested|can't|cannot)(\s|$|thanks)/i

/** Strip phone numbers and emails before sending text to the LLM. */
export function anonymizeReplyText(text: string): string {
  return text
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone]')
    .replace(/[\w.+-]+@[\w.-]+\.\w+/g, '[email]')
    .trim()
}

function classifyByKeyword(text: string): SlotFillReplyClassification | null {
  if (ACCEPT_PATTERN.test(text)) {
    return { intent: 'accept_earlier_slot', confidence: 'high', method: 'keyword' }
  }
  if (DECLINE_PATTERN.test(text)) {
    return { intent: 'decline', confidence: 'high', method: 'keyword' }
  }
  return null
}

const ALLOWED_INTENTS: SlotFillReplyIntent[] = [
  'accept_earlier_slot',
  'decline',
  'question',
  'unrelated',
  'unclear',
]

/**
 * Classify an inbound SMS reply to an earlier-appointment offer.
 * Only the anonymized reply text is sent to the LLM; slot context is generic (no names/phones).
 */
export async function classifySlotFillReply(
  replyText: string,
  context: SlotFillReplyContext
): Promise<SlotFillReplyClassification> {
  const normalized = replyText.trim()
  if (!normalized) {
    return { intent: 'unclear', confidence: 'low', method: 'fallback' }
  }

  const keyword = classifyByKeyword(normalized)
  if (keyword) return keyword

  if (!process.env.OPENAI_API_KEY) {
    return { intent: 'unclear', confidence: 'low', method: 'fallback' }
  }

  const anonymized = anonymizeReplyText(normalized)
  const system = `You classify SMS replies to an earlier appointment offer at a medical practice.
Return JSON only: {"intent":"accept_earlier_slot"|"decline"|"question"|"unrelated"|"unclear","confidence":"low"|"medium"|"high"}

Rules:
- accept_earlier_slot: patient wants the earlier time (yes, sure, move me, book it, etc.)
- decline: patient does not want it
- question: asking about time, provider, location, or how it works
- unrelated: different topic
- unclear: cannot tell

Do not infer medical advice. Use only the reply text and generic slot context.`

  const user = [
    `Offered earlier slot: ${context.offeredSlotDescription}`,
    context.currentAppointmentDescription
      ? `Patient currently scheduled: ${context.currentAppointmentDescription}`
      : null,
    `Reply (anonymized): ${anonymized}`,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })
    const raw = completion.choices[0]?.message?.content?.trim() || ''
    const parsed = JSON.parse(raw) as {
      intent?: SlotFillReplyIntent
      confidence?: 'low' | 'medium' | 'high'
    }
    if (parsed.intent && ALLOWED_INTENTS.includes(parsed.intent)) {
      return {
        intent: parsed.intent,
        confidence: parsed.confidence || 'medium',
        method: 'llm',
      }
    }
  } catch (error) {
    console.warn('[SlotFill] reply classification failed', error)
  }

  return { intent: 'unclear', confidence: 'low', method: 'fallback' }
}
