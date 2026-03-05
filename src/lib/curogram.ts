export interface CurogramEscalationPayload {
  callerNumber: string
  intentTopic?: string
}

interface CurogramEscalationOptions {
  requestId?: string
  callId?: string
}

function parseTimeoutMs(raw: string | undefined): number {
  if (!raw) return 3000
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 3000
  return parsed
}

export function normalizePhoneToE164(phone: string | undefined | null): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '')
    return digits ? `+${digits}` : null
  }

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  return `+${digits}`
}

export function isCurogramEscalationEnabled(): boolean {
  return Boolean(process.env.CUROGRAM_AI_ESCALATION_URL?.trim())
}

export async function sendCurogramEscalation(
  payload: CurogramEscalationPayload,
  options: CurogramEscalationOptions = {}
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = process.env.CUROGRAM_AI_ESCALATION_URL?.trim()
  if (!url) {
    return { ok: false, status: 0, body: 'CUROGRAM_AI_ESCALATION_URL not configured' }
  }

  const timeoutMs = parseTimeoutMs(process.env.CUROGRAM_AI_ESCALATION_TIMEOUT_MS)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const authHeaderName = process.env.CUROGRAM_AI_ESCALATION_AUTH_HEADER?.trim()
  const authHeaderValue = process.env.CUROGRAM_AI_ESCALATION_AUTH_VALUE?.trim()
  if (authHeaderName && authHeaderValue) {
    headers[authHeaderName] = authHeaderValue
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const bodyText = await response.text()
    return { ok: response.ok, status: response.status, body: bodyText }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Curogram error'
    return { ok: false, status: 0, body: message }
  } finally {
    clearTimeout(timeoutId)
    if (options.requestId || options.callId) {
      // Keep options referenced for future request-level tracing.
    }
  }
}

export function resolveCurogramIntentTopic(input: {
  callReason?: string | null
  callSummary?: string | null
  defaultIntent?: string | null
}): string | undefined {
  const callReason = input.callReason?.trim()
  if (callReason) return callReason

  const callSummary = input.callSummary?.trim()
  if (callSummary) return callSummary

  const fallback = input.defaultIntent?.trim()
  if (fallback) return fallback

  return undefined
}
