import OpenAI from 'openai'
import { classifyIntent } from './classifyIntent'

export type SummaryConfidence = 'low' | 'medium' | 'high'

export type SummaryRole = 'patient' | 'staff' | 'agent' | 'system'

export interface SummaryMessage {
  role: SummaryRole
  body: string
  isInternal: boolean
  createdAt: Date
}

export interface SummaryResult {
  whatHappened: string[]
  latestPatientAsk: string
  actionsTaken: string[]
  confidence: SummaryConfidence
}

const fillerRegex =
  /^(hi|hello|hey|thanks|thank you|ok|okay|got it|great|sounds good|bye|goodbye|yes|no|yep|nope)$/i

const actionRules: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(sent|shared|provided|confirmed)\b/i, label: 'Shared information with the patient.' },
  { pattern: /\b(scheduled|booked|rescheduled)\b/i, label: 'Updated the appointment.' },
  { pattern: /\b(follow[- ]?up|check[- ]?in)\b/i, label: 'Planned a follow-up.' },
]

function isFiller(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (trimmed.length <= 8 && fillerRegex.test(trimmed)) return true
  return false
}

async function detectTopic(text: string) {
  const intent = await classifyIntent(text)
  if (intent.label === 'unknown') return null
  switch (intent.label) {
    case 'appointment_scheduling':
      return 'appointment scheduling'
    case 'billing_payment':
      return 'billing or payment'
    case 'insurance_coverage':
      return 'insurance coverage'
    case 'practice_provider':
      return 'the practice provider'
    case 'medication_refill':
      return 'medication or refill'
    case 'test_results':
      return 'test results'
    case 'symptoms':
      return 'symptoms'
    case 'general_admin':
      return 'administrative request'
    default:
      return null
  }
}

function detectAction(text: string) {
  for (const rule of actionRules) {
    if (rule.pattern.test(text)) return rule.label
  }
  return null
}

async function summarizeLatestAsk(messages: SummaryMessage[]) {
  const latestPatient = [...messages]
    .reverse()
    .find((message) => message.role === 'patient' && !isFiller(message.body))
  if (!latestPatient) return 'No pending patient request'
  const topic = await detectTopic(latestPatient.body)
  if (topic) return `Patient is asking about ${topic}.`
  return 'Patient sent a message but no clear request is pending.'
}

async function summarizeTimeline(messages: SummaryMessage[]) {
  const timeline: string[] = []
  for (const message of messages) {
    if (timeline.length >= 3) break
    if (isFiller(message.body)) continue

    if (message.isInternal) {
      timeline.push('Internal note captured for context.')
      continue
    }

    if (message.role === 'patient') {
      const topic = await detectTopic(message.body)
      timeline.push(topic ? `Patient asked about ${topic}.` : 'Patient shared an update.')
      continue
    }

    if (message.role === 'staff' || message.role === 'agent') {
      timeline.push('Staff responded with next steps.')
      continue
    }

    timeline.push('System update recorded.')
  }

  return timeline.length ? timeline : ['Conversation started with no significant update yet.']
}

function summarizeActions(messages: SummaryMessage[]) {
  const actions: string[] = []
  for (const message of messages) {
    if (message.isInternal) {
      actions.push('Internal note added.')
      continue
    }
    if (message.role === 'staff' || message.role === 'agent') {
      const detected = detectAction(message.body)
      actions.push(detected ?? 'Staff replied to the patient.')
    }
  }
  const unique = Array.from(new Set(actions))
  return unique.length ? unique : ['No action taken yet']
}

function determineConfidence(messages: SummaryMessage[], latestAsk: string, actions: string[]) {
  const hasTopic = latestAsk !== 'No pending patient request'
  const hasActions = actions.length > 0 && actions[0] !== 'No action taken yet'
  if (hasTopic && hasActions && messages.length >= 3) return 'high'
  if (hasTopic || hasActions) return 'medium'
  return 'low'
}

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SUMMARY_SYSTEM_PROMPT = `You are a healthcare CRM summarization engine.
Produce a concise summary with three sections:
1) what_happened: 1-3 bullet points
2) latest_patient_ask: one sentence
3) actions_taken: bullet list
Rules:
- Do NOT invent facts.
- No clinical advice.
- Ignore greetings/filler.
Return JSON only:
{"what_happened":["..."],"latest_patient_ask":"...","actions_taken":["..."],"confidence":"low|medium|high"}`

// LLM abstraction placeholder - replace with provider implementation.
export async function summarizeConversation(messages: SummaryMessage[]): Promise<SummaryResult> {
  const chronological = [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  if (process.env.OPENAI_API_KEY) {
    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify(
            chronological.map((message) => ({
              role: message.role,
              body: message.body,
              internal: message.isInternal,
            }))
          ),
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() || ''
    try {
      const parsed = JSON.parse(raw) as {
        whatHappened?: string[]
        what_happened?: string[]
        latestPatientAsk?: string
        latest_patient_ask?: string
        actionsTaken?: string[]
        actions_taken?: string[]
        confidence?: SummaryConfidence
      }
      return {
        whatHappened: parsed.whatHappened ?? parsed.what_happened ?? [],
        latestPatientAsk:
          parsed.latestPatientAsk ?? parsed.latest_patient_ask ?? 'No pending patient request',
        actionsTaken: parsed.actionsTaken ?? parsed.actions_taken ?? [],
        confidence: parsed.confidence || 'low',
      }
    } catch {
      // fall through to heuristic fallback
    }
  }

  const whatHappened = await summarizeTimeline(chronological)
  const latestPatientAsk = await summarizeLatestAsk(chronological)
  const actionsTaken = summarizeActions(chronological)
  const confidence = determineConfidence(chronological, latestPatientAsk, actionsTaken)

  return {
    whatHappened,
    latestPatientAsk,
    actionsTaken,
    confidence,
  }
}
