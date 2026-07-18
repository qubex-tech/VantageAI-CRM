import OpenAI, { toFile } from 'openai'
import type { AriaSoapNote } from '@/lib/aria/types'
import { emptySoapNote } from '@/lib/aria/types'

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export interface AriaContextSnippet {
  label: string
  text: string
}

export async function generateAriaSoapNote(params: {
  transcript: string
  patientName: string
  visitType?: string | null
  reason?: string | null
  contextSnippets?: AriaContextSnippet[]
}): Promise<{ soap: AriaSoapNote; meta: Record<string, unknown> }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  const openai = getOpenAIClient()
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const started = Date.now()

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.1,
    max_tokens: 1800,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You are Aria, a clinical documentation scribe for outpatient visits.',
          'Produce a draft SOAP note from the visit transcript and optional chart context.',
          'Rules:',
          '- Use only information supported by the transcript or provided context.',
          '- Do not invent diagnoses, meds, vitals, or exam findings.',
          '- If a section lacks support, write a brief placeholder like "Not discussed."',
          '- Write concise clinical prose suitable for clinician review.',
          '- Return strict JSON with keys: subjective, objective, assessment, plan, addendum.',
          '- Put post-visit clinician dictation content in addendum when clearly marked as such; otherwise leave addendum empty.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          agent: 'aria',
          patientName: params.patientName,
          visitType: params.visitType ?? null,
          reason: params.reason ?? null,
          context: (params.contextSnippets ?? []).slice(0, 20),
          transcript: params.transcript.slice(0, 100_000),
        }),
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch {
    parsed = {}
  }

  const soap: AriaSoapNote = {
    ...emptySoapNote(),
    subjective: typeof parsed.subjective === 'string' ? parsed.subjective : '',
    objective: typeof parsed.objective === 'string' ? parsed.objective : '',
    assessment: typeof parsed.assessment === 'string' ? parsed.assessment : '',
    plan: typeof parsed.plan === 'string' ? parsed.plan : '',
    addendum: typeof parsed.addendum === 'string' ? parsed.addendum : '',
  }

  return {
    soap,
    meta: {
      agent: 'aria',
      model,
      latencyMs: Date.now() - started,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
    },
  }
}

export async function transcribeAriaAudio(params: {
  audio: Buffer
  mimeType: string
  filename?: string
}): Promise<{ transcript: string; meta: Record<string, unknown> }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  const openai = getOpenAIClient()
  const started = Date.now()
  const ext = params.mimeType.includes('wav')
    ? 'wav'
    : params.mimeType.includes('webm')
      ? 'webm'
      : params.mimeType.includes('mpeg') || params.mimeType.includes('mp3')
        ? 'mp3'
        : 'm4a'

  const file = await toFile(params.audio, params.filename ?? `aria.${ext}`, {
    type: params.mimeType || `audio/${ext}`,
  })

  const result = await openai.audio.transcriptions.create({
    file,
    model: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
  })

  return {
    transcript: result.text?.trim() ?? '',
    meta: {
      agent: 'aria',
      asrModel: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
      latencyMs: Date.now() - started,
    },
  }
}
