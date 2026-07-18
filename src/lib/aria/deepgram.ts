export const ARIA_DEEPGRAM_MODEL = 'nova-3-medical'
export const ARIA_DEEPGRAM_LISTEN_URL = 'wss://api.deepgram.com/v1/listen'
/** Minimum streamed transcript length to skip Whisper on finalize */
export const ARIA_STREAM_TRANSCRIPT_MIN_CHARS = 40

const GRANT_URL = 'https://api.deepgram.com/v1/auth/grant'
const DEFAULT_TTL_SECONDS = 600

export function isDeepgramConfigured(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY?.trim())
}

export type DeepgramGrant = {
  accessToken: string
  expiresIn: number
  model: string
  listenUrl: string
}

export async function grantDeepgramStreamToken(params?: {
  ttlSeconds?: number
}): Promise<DeepgramGrant> {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('DEEPGRAM_NOT_CONFIGURED')
  }

  const ttlSeconds = Math.min(
    Math.max(params?.ttlSeconds ?? DEFAULT_TTL_SECONDS, 30),
    3600
  )

  const res = await fetch(GRANT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ttl_seconds: ttlSeconds }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[aria/deepgram] grant failed', res.status, body.slice(0, 300))
    throw new Error(`DEEPGRAM_GRANT_FAILED:${res.status}`)
  }

  const json = (await res.json()) as {
    access_token?: string
    expires_in?: number
  }
  if (!json.access_token) {
    throw new Error('DEEPGRAM_GRANT_INVALID')
  }

  return {
    accessToken: json.access_token,
    expiresIn: typeof json.expires_in === 'number' ? json.expires_in : ttlSeconds,
    model: ARIA_DEEPGRAM_MODEL,
    listenUrl: ARIA_DEEPGRAM_LISTEN_URL,
  }
}

export function deepgramUnavailableResponse() {
  return {
    error: 'Live transcription is not configured',
    code: 'DEEPGRAM_NOT_CONFIGURED' as const,
  }
}
