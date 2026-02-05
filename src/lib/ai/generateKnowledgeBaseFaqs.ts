import OpenAI from 'openai'

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SYSTEM_PROMPT = `You are converting clinic policy content into FAQs for staff use.
Rules:
- 3-6 FAQs max.
- Questions should be phrased like patients ask.
- Answers must be concise and operational.
- No clinical advice. No PHI.
Return JSON only:
{"faqs":[{"question":"...","answer":"..."}]}`

export async function generateKnowledgeBaseFaqs(input: {
  title: string
  body: string
  summary?: string | null
  tags?: string[]
}): Promise<Array<{ question: string; answer: string }>> {
  if (!process.env.OPENAI_API_KEY) {
    return []
  }

  const openai = getOpenAIClient()
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(input) },
    ],
  })

  const raw = completion.choices[0]?.message?.content?.trim() || ''
  try {
    const parsed = JSON.parse(raw) as { faqs?: Array<{ question: string; answer: string }> }
    return Array.isArray(parsed.faqs) ? parsed.faqs : []
  } catch {
    return []
  }
}
