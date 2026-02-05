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
}

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SYSTEM_PROMPT = `You are a classification engine for healthcare CRM inbox messages.
Classify the patient's intent into ONE of the allowed labels.
Never provide medical advice. Only classify the request.
Return JSON only in the following format:
{"label":"...", "confidence":"low|medium|high"}`

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

// LLM abstraction placeholder - replace with provider implementation.
export async function classifyIntent(message: string): Promise<IntentResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { label: 'unknown', confidence: 'low' }
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
      return { label: 'unknown', confidence: 'low' }
    }
    return parsed
  } catch {
    return { label: 'unknown', confidence: 'low' }
  }
}
