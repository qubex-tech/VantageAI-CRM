import { clipGlassesLine } from '@/lib/glasses/cards'
import { externalAskAllowed, glassesAskModel, isHealthcareAddendumSigned } from '@/lib/glasses/healthcare-gate'
import { GLASSES_ANSWER_WIDTH, type GlassesAskModel, type GlassesSnippet } from '@/lib/glasses/types'

const STOP = new Set(['the', 'and', 'for', 'with', 'what', 'whats', 'who', 'how', 'does', 'have', 'any', 'this', 'that', 'from', 'about'])

export function answerFromChart(question: string, snippets: GlassesSnippet[]): string {
  const asked = question.replace(/\s+/g, ' ').trim()
  if (!asked) return 'Ask a short chart question.'
  const terms = asked
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOP.has(term))
  if (terms.length === 0) return 'Ask a short chart question.'

  let bestScore = 0
  let best = ''
  for (const snippet of snippets) {
    const haystack = `${snippet.label} ${snippet.text}`.toLowerCase()
    const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      best = snippet.text
    }
  }
  if (!best) return 'Nothing in the loaded chart matches that.'
  return clipGlassesLine(best, GLASSES_ANSWER_WIDTH)
}

export function glassesAskPrompt(question: string, snippets: GlassesSnippet[]): string {
  const lines = snippets
    .map((snippet) => `- ${snippet.label}: ${snippet.text.replace(/\s+/g, ' ').trim()}`)
    .join('\n')
  return [
    'Answer in one short line a clinician can read on glasses.',
    'Use only the chart lines below. If the answer is not there, say it is not in the loaded chart.',
    '',
    'Chart:',
    lines || '- (empty)',
    '',
    `Question: ${question.replace(/\s+/g, ' ').trim()}`,
  ].join('\n')
}

type CompleteAsk = (args: { model: Exclude<GlassesAskModel, 'local'>; prompt: string }) => Promise<string>

export async function answerGlassesQuestion(params: {
  question: string
  snippets: GlassesSnippet[]
  demo: boolean
  env?: NodeJS.ProcessEnv
  complete?: CompleteAsk
}): Promise<{ answer: string; model: GlassesAskModel; modelBlocked?: GlassesAskModel }> {
  const env = params.env ?? process.env
  const local = answerFromChart(params.question, params.snippets)
  const model = glassesAskModel(env)
  if (model === 'local') return { answer: local, model: 'local' }

  const addendumSigned = isHealthcareAddendumSigned(env)
  if (!externalAskAllowed({ model, demo: params.demo, addendumSigned })) {
    return { answer: local, model: 'local', modelBlocked: model }
  }

  try {
    const complete = params.complete ?? completeExternalAsk
    const text = await complete({
      model,
      prompt: glassesAskPrompt(params.question, params.snippets),
    })
    const answer = clipGlassesLine(text, GLASSES_ANSWER_WIDTH)
    if (!answer) return { answer: local, model: 'local', modelBlocked: model }
    return { answer, model }
  } catch {
    return { answer: local, model: 'local', modelBlocked: model }
  }
}

async function completeExternalAsk(args: {
  model: Exclude<GlassesAskModel, 'local'>
  prompt: string
}): Promise<string> {
  if (args.model === 'muse') {
    const key = process.env.MODEL_API_KEY
    if (!key) throw new Error('Muse API key is not configured')
    const response = await fetch('https://api.meta.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'muse-spark-1.3',
        messages: [{ role: 'user', content: args.prompt }],
        max_tokens: 80,
      }),
    })
    if (!response.ok) throw new Error(`Muse request failed (${response.status})`)
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return body.choices?.[0]?.message?.content?.trim() ?? ''
  }

  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OpenAI API key is not configured')
  const { default: OpenAI } = await import('openai')
  const client = new OpenAI({ apiKey: key })
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_GLASSES_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'user', content: args.prompt }],
    max_tokens: 80,
  })
  return completion.choices[0]?.message?.content?.trim() ?? ''
}
