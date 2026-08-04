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

function coerceSoapField(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value
      .map((item) => coerceSoapField(item))
      .filter(Boolean)
      .join('\n')
      .trim()
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of ['text', 'content', 'value', 'summary', 'note']) {
      const nested = coerceSoapField(obj[key])
      if (nested) return nested
    }
    // Join stringy leaf values if the model nested bullets/objects
    const parts = Object.values(obj)
      .map((v) => coerceSoapField(v))
      .filter(Boolean)
    if (parts.length) return parts.join('\n').trim()
  }
  return ''
}

function pickSoapField(source: Record<string, unknown>, keys: string[]): string {
  const lowerMap = new Map<string, unknown>()
  for (const [k, v] of Object.entries(source)) {
    lowerMap.set(k.toLowerCase().replace(/[\s_-]+/g, ''), v)
  }
  for (const key of keys) {
    const normalized = key.toLowerCase().replace(/[\s_-]+/g, '')
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const text = coerceSoapField(source[key])
      if (text) return text
    }
    if (lowerMap.has(normalized)) {
      const text = coerceSoapField(lowerMap.get(normalized))
      if (text) return text
    }
  }
  return ''
}

/** Normalize model JSON into Aria SOAP fields (handles nested/cased variants). */
export function extractSoapFromModelJson(raw: unknown): AriaSoapNote {
  const empty = emptySoapNote()
  if (!raw || typeof raw !== 'object') return empty
  const root = raw as Record<string, unknown>

  const candidates: Record<string, unknown>[] = [root]
  for (const wrapKey of ['soap', 'note', 'soapNote', 'draft', 'document', 'result']) {
    const nested = root[wrapKey]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      candidates.push(nested as Record<string, unknown>)
    }
  }

  for (const source of candidates) {
    const soap: AriaSoapNote = {
      subjective: pickSoapField(source, ['subjective', 'S', 'subj']),
      objective: pickSoapField(source, ['objective', 'O', 'obj']),
      assessment: pickSoapField(source, ['assessment', 'A', 'assess']),
      plan: pickSoapField(source, ['plan', 'P']),
      addendum: pickSoapField(source, ['addendum', 'dictation', 'addendumNote']),
    }
    if (soap.subjective || soap.objective || soap.assessment || soap.plan || soap.addendum) {
      return soap
    }
  }

  return empty
}

export function soapHasContent(soap: AriaSoapNote): boolean {
  return Boolean(
    soap.subjective.trim() ||
      soap.objective.trim() ||
      soap.assessment.trim() ||
      soap.plan.trim() ||
      (soap.addendum || '').trim()
  )
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
          '- Return a flat JSON object only (no nested soap/note wrappers).',
          '- Every value must be a plain string.',
          '- Required string keys exactly: subjective, objective, assessment, plan, addendum.',
          '- Put post-visit clinician dictation content in addendum when clearly marked as such; otherwise set addendum to an empty string.',
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
  let parsed: unknown = {}
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Strip accidental markdown fences then retry
    const fenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    try {
      parsed = JSON.parse(fenced)
    } catch {
      parsed = {}
    }
  }

  const soap = extractSoapFromModelJson(parsed)
  if (!soapHasContent(soap)) {
    const err = new Error('SOAP generation returned empty sections')
    ;(err as Error & { rawContent?: string }).rawContent = raw.slice(0, 2000)
    throw err
  }

  return {
    soap,
    meta: {
      agent: 'aria',
      model,
      latencyMs: Date.now() - started,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      rawContentPreview: raw.slice(0, 500),
    },
  }
}

async function transcribeWithModel(params: {
  openai: OpenAI
  file: Awaited<ReturnType<typeof toFile>>
  model: string
}): Promise<string> {
  const result = await params.openai.audio.transcriptions.create({
    file: params.file,
    model: params.model,
  })
  return result.text?.trim() ?? ''
}

/**
 * Prefer gpt-4o-mini-transcribe (faster); fall back to whisper-1.
 * Override with OPENAI_WHISPER_MODEL.
 */
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

  const preferred = process.env.OPENAI_WHISPER_MODEL || 'gpt-4o-mini-transcribe'
  const fallback = 'whisper-1'

  let modelUsed = preferred
  let transcript = ''
  try {
    transcript = await transcribeWithModel({ openai, file, model: preferred })
  } catch (err) {
    if (preferred !== fallback) {
      console.warn(`[aria] ASR model ${preferred} failed; falling back to ${fallback}`, err)
      modelUsed = fallback
      // toFile streams may be consumed; rebuild file for retry
      const retryFile = await toFile(params.audio, params.filename ?? `aria.${ext}`, {
        type: params.mimeType || `audio/${ext}`,
      })
      transcript = await transcribeWithModel({ openai, file: retryFile, model: fallback })
    } else {
      throw err
    }
  }

  return {
    transcript,
    meta: {
      agent: 'aria',
      asrModel: modelUsed,
      latencyMs: Date.now() - started,
    },
  }
}
