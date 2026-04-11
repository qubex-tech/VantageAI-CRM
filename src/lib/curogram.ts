export interface CurogramEscalationPayload {
  callerNumber: string
  intentTopic?: string
  patientData?: Record<string, unknown>
}

interface CurogramEscalationOptions {
  requestId?: string
  callId?: string
  endpointUrl?: string | null
  timeoutMs?: number
  authHeaderName?: string | null
  authHeaderValue?: string | null
}

function parseTimeoutMs(raw: string | undefined): number {
  if (!raw) return 3000
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 3000
  return parsed
}

/** Curogram escalation webhook may 500 on very long intent strings; cap before POST. */
export function trimCurogramIntentTopicForApi(topic: string | undefined): string | undefined {
  if (!topic) return undefined
  const raw = process.env.CUROGRAM_INTENT_TOPIC_MAX_CHARS?.trim()
  /** Default allows call summary plus patient name/email/phone/DOB lines without clipping. */
  const max = raw ? Number.parseInt(raw, 10) : 4000
  if (!Number.isFinite(max) || max <= 0) return topic
  if (topic.length <= max) return topic
  return `${topic.slice(0, Math.max(0, max - 1))}\u2026`
}

export function normalizePhoneToE164(phone: unknown): string | null {
  if (phone === null || phone === undefined) return null
  const trimmed = String(phone).trim()
  if (!trimmed) return null

  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '')
    return digits ? `+${digits}` : null
  }

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  return `+${digits}`
}

export function isCurogramEscalationEnabled(input: {
  enabled: boolean
  endpointUrl?: string | null
}): boolean {
  return Boolean(input.enabled && input.endpointUrl?.trim())
}

export async function sendCurogramEscalation(
  payload: CurogramEscalationPayload,
  options: CurogramEscalationOptions = {}
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = options.endpointUrl?.trim() || process.env.CUROGRAM_AI_ESCALATION_URL?.trim()
  if (!url) {
    return { ok: false, status: 0, body: 'Curogram escalation URL not configured' }
  }

  const timeoutMs = options.timeoutMs || parseTimeoutMs(process.env.CUROGRAM_AI_ESCALATION_TIMEOUT_MS)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const authHeaderName = options.authHeaderName?.trim() || process.env.CUROGRAM_AI_ESCALATION_AUTH_HEADER?.trim()
  const authHeaderValue = options.authHeaderValue?.trim() || process.env.CUROGRAM_AI_ESCALATION_AUTH_VALUE?.trim()
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

/**
 * Prefer Retell `call_summary` (narrative paragraph shown in Call Analysis) for Curogram `intentTopic`;
 * fall back to `call_reason`, then default. `trimCurogramIntentTopicForApi` still caps length before POST.
 */
export function resolveCurogramIntentTopic(input: {
  callReason?: string | null
  callSummary?: string | null
  defaultIntent?: string | null
}): string | undefined {
  const callSummary = input.callSummary?.trim()
  if (callSummary) return callSummary

  const callReason = input.callReason?.trim()
  if (callReason) return callReason

  const fallback = input.defaultIntent?.trim()
  if (fallback) return fallback

  return undefined
}

/** Fields read from `ExtractedCallData` for the Curogram topic line block. */
export type CurogramIntentPatientFields = {
  call_summary?: string | null
  call_reason?: string | null
  patient_name?: string | null
  patient_email?: string | null
  patient_phone_number?: string | null
  user_phone_number?: string | null
  patient_dob?: string | null
  insurance_verification?: { patient_dob?: string | null } | null
}

/**
 * Call summary (or reason / default) plus optional patient lines, only for fields that are present.
 */
export function buildCurogramIntentTopicWithPatientContext(params: {
  extracted: CurogramIntentPatientFields
  defaultIntent?: string | null
}): string | undefined {
  const base = resolveCurogramIntentTopic({
    callSummary: params.extracted.call_summary,
    callReason: params.extracted.call_reason,
    defaultIntent: params.defaultIntent ?? 'AI call escalation',
  })

  const name = params.extracted.patient_name?.trim()
  const email = params.extracted.patient_email?.trim()
  const phone =
    params.extracted.patient_phone_number?.trim() || params.extracted.user_phone_number?.trim()
  const dob =
    params.extracted.patient_dob?.trim() ||
    params.extracted.insurance_verification?.patient_dob?.trim()

  const patientLines: string[] = []
  if (name) patientLines.push(`Patient name: ${name}`)
  if (email) patientLines.push(`Email address: ${email}`)
  if (phone) patientLines.push(`Phone number: ${phone}`)
  if (dob) patientLines.push(`DOB: ${dob}`)

  if (patientLines.length === 0) {
    return base
  }

  const patientBlock = patientLines.join('\n')
  if (!base?.trim()) {
    return patientBlock
  }

  return `${base.trim()}\n\n${patientBlock}`
}
