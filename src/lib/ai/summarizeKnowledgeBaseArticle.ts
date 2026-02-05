import OpenAI from 'openai'

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SYSTEM_PROMPT = `You summarize clinic knowledge base articles for internal AI usage.
Rules:
- 2-4 short sentences, operational only.
- No clinical advice.
- Preserve exact policy language and constraints.
Return JSON only: {"summary":"..."}`

export async function summarizeKnowledgeBaseArticle(input: {
  title: string
  body: string
  tags?: string[]
}): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return `${input.title}. ${input.body.slice(0, 240)}`
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
    const parsed = JSON.parse(raw) as { summary?: string }
    return parsed.summary || `${input.title}. ${input.body.slice(0, 240)}`
  } catch {
    return `${input.title}. ${input.body.slice(0, 240)}`
  }
}
