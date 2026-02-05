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

const topicRules: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(reschedule|schedule|appointment|book|booking|visit)\b/i, label: 'appointment scheduling' },
  { pattern: /\b(billing|bill|invoice|payment|charge|copay)\b/i, label: 'billing or payment' },
  { pattern: /\b(insurance|coverage|benefit|plan)\b/i, label: 'insurance coverage' },
  { pattern: /\b(refill|prescription|medication|pharmacy)\b/i, label: 'medication or refill' },
  { pattern: /\b(results|lab|test|imaging|x-ray|mri)\b/i, label: 'test results' },
  { pattern: /\b(symptom|pain|fever|cough|nausea|dizzy|headache)\b/i, label: 'symptoms' },
]

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

function detectTopic(text: string) {
  for (const rule of topicRules) {
    if (rule.pattern.test(text)) return rule.label
  }
  return null
}

function detectAction(text: string) {
  for (const rule of actionRules) {
    if (rule.pattern.test(text)) return rule.label
  }
  return null
}

function summarizeLatestAsk(messages: SummaryMessage[]) {
  const latestPatient = [...messages]
    .reverse()
    .find((message) => message.role === 'patient' && !isFiller(message.body))
  if (!latestPatient) return 'No pending patient request'
  const topic = detectTopic(latestPatient.body)
  if (topic) return `Patient is asking about ${topic}.`
  return 'Patient sent a message but no clear request is pending.'
}

function summarizeTimeline(messages: SummaryMessage[]) {
  const timeline: string[] = []
  for (const message of messages) {
    if (timeline.length >= 3) break
    if (isFiller(message.body)) continue

    if (message.isInternal) {
      timeline.push('Internal note captured for context.')
      continue
    }

    if (message.role === 'patient') {
      const topic = detectTopic(message.body)
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

// LLM abstraction placeholder - replace with provider implementation.
export async function summarizeConversation(messages: SummaryMessage[]): Promise<SummaryResult> {
  const chronological = [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const whatHappened = summarizeTimeline(chronological)
  const latestPatientAsk = summarizeLatestAsk(chronological)
  const actionsTaken = summarizeActions(chronological)
  const confidence = determineConfidence(chronological, latestPatientAsk, actionsTaken)

  return {
    whatHappened,
    latestPatientAsk,
    actionsTaken,
    confidence,
  }
}
