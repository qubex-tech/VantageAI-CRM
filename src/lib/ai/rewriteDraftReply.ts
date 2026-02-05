import OpenAI from 'openai'
import type { DraftConfidence } from './generateDraftReply'

export type RewriteMode = 'shorten' | 'empathetic' | 'direct' | 'spanish' | 'english'

export interface RewriteResult {
  draftText: string
  confidence: DraftConfidence
}

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SYSTEM_PROMPT = `You are rewriting a healthcare CRM draft reply.
Rules:
- Preserve meaning. No new information.
- Keep any inline citations (e.g., [KB: Title]) exactly as-is.
- No clinical advice.
- Output JSON only: {"draft_text":"...", "confidence":"low|medium|high"}`

// LLM abstraction placeholder - replace with provider implementation.
export async function rewriteDraftReply(
  draftText: string,
  mode?: RewriteMode,
  prompt?: string
): Promise<RewriteResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { draftText, confidence: 'low' }
  }

  const instruction =
    prompt ||
    (mode === 'shorten'
      ? 'Shorten the draft without losing meaning.'
      : mode === 'empathetic'
        ? 'Make the draft more empathetic.'
        : mode === 'direct'
          ? 'Make the draft more direct and concise.'
          : mode === 'spanish'
            ? 'Translate the draft to Spanish.'
            : mode === 'english'
              ? 'Translate the draft to English.'
              : 'Rewrite the draft to improve clarity.')

  const openai = getOpenAIClient()
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ instruction, draftText }) },
    ],
  })

  const raw = completion.choices[0]?.message?.content?.trim() || ''
  try {
    const parsed = JSON.parse(raw) as { draft_text?: string; draftText?: string; confidence?: DraftConfidence }
    return {
      draftText: parsed.draftText ?? parsed.draft_text ?? draftText,
      confidence: parsed.confidence || 'medium',
    }
  } catch {
    return { draftText, confidence: 'low' }
  }
}
