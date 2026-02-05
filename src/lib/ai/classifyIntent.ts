import OpenAI from 'openai'

export type IntentLabel =
  | 'appointment_scheduling'
  | 'billing_payment'
  | 'insurance_coverage'
  | 'practice_provider'
  | 'medication_refill'
  | 'test_results'
  | 'symptoms'
  | 'general_admin'
  | 'unknown'

export interface IntentResult {
  label: IntentLabel
  confidence: 'low' | 'medium' | 'high'
  sources: Array<'kb' | 'patient' | 'both' | 'none'>
}

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SYSTEM_PROMPT = `You are a classification engine for healthcare CRM inbox messages.
Classify the patient's intent into ONE of the allowed labels.
Also indicate which sources should be consulted for drafting a response.
Sources: "kb" (clinic policies/FAQ like insurance, billing, Medicare, office policies),
"patient" (specific patient facts like appointment time), "both", or "none".
Never provide medical advice. Only classify the request.

Examples:
User: "Do you take Medicare?"
Return: {"label":"insurance_coverage","confidence":"high","sources":["kb"]}

User: "What's my appointment time?"
Return: {"label":"appointment_scheduling","confidence":"high","sources":["patient"]}

User: "Who is the doctor at your practice?"
Return: {"label":"practice_provider","confidence":"high","sources":["kb"]}

User: "Can you confirm my appointment time and who the doctor is?"
Return: {"label":"appointment_scheduling","confidence":"high","sources":["both"]}

Return JSON only in the following format:
{"label":"...", "confidence":"low|medium|high", "sources":["kb"|"patient"|"both"|"none"]}`

const ALLOWED_LABELS: IntentLabel[] = [
  'appointment_scheduling',
  'billing_payment',
  'insurance_coverage',
  'practice_provider',
  'medication_refill',
  'test_results',
  'symptoms',
  'general_admin',
  'unknown',
]

const ALLOWED_SOURCES = ['kb', 'patient', 'both', 'none'] as const
type AllowedSource = (typeof ALLOWED_SOURCES)[number]

function isAllowedSource(value: string): value is AllowedSource {
  return ALLOWED_SOURCES.includes(value as AllowedSource)
}

// LLM abstraction placeholder - replace with provider implementation.
export async function classifyIntent(message: string): Promise<IntentResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { label: 'unknown', confidence: 'low', sources: ['none'] }
  }

  const openai = getOpenAIClient()
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message },
    ],
  })

  const raw = completion.choices[0]?.message?.content?.trim() || ''
  try {
    const parsed = JSON.parse(raw) as IntentResult
    if (!ALLOWED_LABELS.includes(parsed.label)) {
      return { label: 'unknown', confidence: 'low', sources: ['none'] }
    }
    const sources =
      Array.isArray(parsed.sources) && parsed.sources.length
        ? parsed.sources.filter((item): item is AllowedSource => isAllowedSource(item))
        : (['none'] as AllowedSource[])
    return {
      label: parsed.label,
      confidence: parsed.confidence || 'low',
      sources: sources.length ? sources : ['none'],
    }
  } catch {
    return { label: 'unknown', confidence: 'low', sources: ['none'] }
  }
}
