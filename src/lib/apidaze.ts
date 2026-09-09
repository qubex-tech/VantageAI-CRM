/**
 * Apidaze CPaaS client (platform-wide credentials).
 *
 * Auth is application-level: API key in the path, API secret as a query param.
 * Numbers assigned to that application can be used as SMS From.
 * Docs: https://api.apidaze.io/docs/
 */

import { phoneNumbersMatchLoosely } from '@/lib/patient-phone-match'

export const DEFAULT_APIDAZE_API_BASE_URL = 'https://cpaas-api.voipinnovations.com'

export const APIDAZE_EMPTY_SCRIPT_XML =
  '<?xml version="1.0" encoding="UTF-8"?>\n<document>\n  <work></work>\n</document>\n'

export interface ApidazeCredentials {
  apiKey: string
  apiSecret: string
  baseUrl: string
}

export interface ApidazePhoneNumber {
  id: string
  phoneNumber: string
}

export interface SendSmsParams {
  to: string
  body: string
  from?: string
}

export interface SendSmsResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface ApidazeInboundParams {
  from: string | null
  to: string | null
  body: string | null
  uuid: string | null
}

export function resolveApidazeApiBaseUrl(raw?: string | null): string {
  let value = (raw ?? '').trim().replace(/^['"]+|['"]+$/g, '').trim()
  if (!value) {
    return DEFAULT_APIDAZE_API_BASE_URL
  }

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`
  }

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_APIDAZE_API_BASE_URL
    }

    const path = parsed.pathname.replace(/\/$/, '')
    if (path === '/docs' || path.startsWith('/docs/')) {
      return DEFAULT_APIDAZE_API_BASE_URL
    }

    return `${parsed.origin}${path}`
  } catch {
    return DEFAULT_APIDAZE_API_BASE_URL
  }
}

export function getApidazeApiBaseUrl(): string {
  return resolveApidazeApiBaseUrl(process.env.APIDAZE_API_BASE_URL)
}

export function buildApidazeRequestUrl(
  credentials: Pick<ApidazeCredentials, 'apiKey' | 'apiSecret' | 'baseUrl'>,
  path: string
): string {
  const base = resolveApidazeApiBaseUrl(credentials.baseUrl)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${base}/${encodeURIComponent(credentials.apiKey)}${normalizedPath}`)
  url.searchParams.set('api_secret', credentials.apiSecret)
  return url.toString()
}

export function getApidazeCredentials(): ApidazeCredentials | null {
  const apiKey = process.env.APIDAZE_API_KEY?.trim()
  const apiSecret = process.env.APIDAZE_API_SECRET?.trim()
  if (!apiKey || !apiSecret) return null
  return {
    apiKey,
    apiSecret,
    baseUrl: getApidazeApiBaseUrl(),
  }
}

export function isApidazePlatformConfigured(): boolean {
  return Boolean(getApidazeCredentials())
}

export function formatE164(phone: string): string {
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) {
    return trimmed
  }
  const digits = trimmed.replace(/[^\d]/g, '')
  if (digits.length === 10) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  return trimmed
}

/** Apidaze expects country code without a leading +. */
export function formatApidazeNumber(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '')
  if (digits.length === 10) {
    return `1${digits}`
  }
  return digits
}

export function apidazePhoneNumbersMatch(a?: string | null, b?: string | null): boolean {
  return phoneNumbersMatchLoosely(a, b)
}

function stripXmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function parseApidazeNumbersPayload(payload: string): ApidazePhoneNumber[] {
  const trimmed = payload.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const rows = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? Object.values(parsed as Record<string, unknown>)
          : []
      const numbers: ApidazePhoneNumber[] = []
      for (const row of rows) {
        if (typeof row === 'string') {
          const phoneNumber = formatE164(row)
          if (formatApidazeNumber(phoneNumber).length >= 10) {
            numbers.push({ id: phoneNumber, phoneNumber })
          }
          continue
        }
        if (!row || typeof row !== 'object') continue
        const record = row as Record<string, unknown>
        const raw =
          (typeof record.number === 'string' && record.number) ||
          (typeof record.phone_number === 'string' && record.phone_number) ||
          (typeof record.phoneNumber === 'string' && record.phoneNumber) ||
          ''
        if (!raw) continue
        const phoneNumber = formatE164(raw)
        if (formatApidazeNumber(phoneNumber).length >= 10) {
          numbers.push({
            id: typeof record.id === 'string' ? record.id : phoneNumber,
            phoneNumber,
          })
        }
      }
      return dedupeNumbers(numbers)
    } catch {
      // Fall through to XML / digit parsing.
    }
  }

  const numbers: ApidazePhoneNumber[] = []

  for (const match of trimmed.matchAll(/<number(?:\s[^>]*)?>([^<]+)<\/number>/gi)) {
    const raw = match[1]?.trim()
    if (!raw || /[a-z]/i.test(raw)) continue
    const phoneNumber = formatE164(raw)
    if (formatApidazeNumber(phoneNumber).length >= 10) {
      numbers.push({ id: phoneNumber, phoneNumber })
    }
  }

  for (const match of trimmed.matchAll(
    /\b(?:number|phone_number|phoneNumber)=["']([^"']+)["']/gi
  )) {
    const raw = match[1]?.trim()
    if (!raw) continue
    const phoneNumber = formatE164(raw)
    if (formatApidazeNumber(phoneNumber).length >= 10) {
      numbers.push({ id: phoneNumber, phoneNumber })
    }
  }

  if (numbers.length === 0) {
    for (const match of trimmed.matchAll(/\b(\+?1?\d{10,15})\b/g)) {
      const phoneNumber = formatE164(match[1])
      if (formatApidazeNumber(phoneNumber).length >= 10) {
        numbers.push({ id: phoneNumber, phoneNumber })
      }
    }
  }

  return dedupeNumbers(numbers)
}

function dedupeNumbers(numbers: ApidazePhoneNumber[]): ApidazePhoneNumber[] {
  const byDigits = new Map<string, ApidazePhoneNumber>()
  for (const entry of numbers) {
    const key = formatApidazeNumber(entry.phoneNumber)
    if (!byDigits.has(key)) {
      byDigits.set(key, entry)
    }
  }
  return Array.from(byDigits.values()).sort((a, b) =>
    a.phoneNumber.localeCompare(b.phoneNumber)
  )
}

export function parseApidazeSendResponse(payload: string, status: number): SendSmsResult {
  const trimmed = payload.trim()
  const errorMatch = trimmed.match(/<(?:error|errors)[^>]*>([\s\S]*?)<\/(?:error|errors)>/i)
  const okMatch = trimmed.match(/<(?:ok|success)[^>]*>([\s\S]*?)<\/(?:ok|success)>/i)
  const idMatch = trimmed.match(
    /<(?:id|uuid|message_id|messageid|message-id)[^>]*>([^<]+)</i
  )

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      const message =
        (typeof parsed.message === 'string' && parsed.message) ||
        (typeof parsed.error === 'string' && parsed.error) ||
        ''
      const code = typeof parsed.code === 'string' ? parsed.code : ''
      if (
        status < 200 ||
        status >= 300 ||
        code.startsWith('E_') ||
        /fail|denied|invalid|unauthorized|error/i.test(`${code} ${message}`)
      ) {
        return {
          success: false,
          error: message || code || `Apidaze SMS send failed (HTTP ${status})`,
        }
      }
      const messageId =
        (typeof parsed.id === 'string' && parsed.id) ||
        (typeof parsed.uuid === 'string' && parsed.uuid) ||
        (typeof parsed.message_id === 'string' && parsed.message_id) ||
        undefined
      if (parsed.ok === true || parsed.success === true || parsed.status === 'ok' || messageId) {
        return { success: true, messageId }
      }
    } catch {
      // Fall through to XML / text parsing.
    }
  }

  if (status < 200 || status >= 300 || errorMatch) {
    const detail = stripXmlTags(errorMatch?.[1] || trimmed).slice(0, 400)
    return {
      success: false,
      error: detail || `Apidaze SMS send failed (HTTP ${status})`,
    }
  }

  if (!trimmed) {
    return {
      success: false,
      error: 'Apidaze returned an empty success response; the message was not confirmed as queued.',
    }
  }

  if (/fail|denied|invalid|unauthorized/i.test(trimmed) && !okMatch) {
    const detail = stripXmlTags(trimmed).slice(0, 400)
    return { success: false, error: detail || 'Apidaze SMS send failed' }
  }

  if (okMatch || idMatch || /queued|submitted|sent|accepted/i.test(trimmed)) {
    return {
      success: true,
      messageId: idMatch?.[1]?.trim() || undefined,
    }
  }

  return {
    success: false,
    error: `Apidaze did not confirm the SMS was queued: ${stripXmlTags(trimmed).slice(0, 240)}`,
  }
}

export function parseApidazeInboundParams(
  source: Record<string, string | null | undefined>
): ApidazeInboundParams {
  const lookup = new Map<string, string>()
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string' && value.trim()) {
      lookup.set(key.toLowerCase(), value.trim())
    }
  }

  const get = (...keys: string[]) => {
    for (const key of keys) {
      const value = lookup.get(key.toLowerCase())
      if (value) return value
    }
    return null
  }

  return {
    from: get('caller_id_number', 'from', 'callerid', 'caller_id', 'origination_number'),
    to: get('destination_number', 'to', 'called_number', 'called', 'did'),
    body: get('body', 'text', 'message', 'sms_body', 'smsbody', 'content'),
    uuid: get('uuid', 'message_uuid', 'messageid', 'id'),
  }
}

export function isApidazeWebhookAuthorized(providedSecret?: string | null): boolean {
  const expected = process.env.APIDAZE_WEBHOOK_SECRET?.trim()
  if (!expected) return true
  return Boolean(providedSecret && providedSecret === expected)
}

export function getApidazeInboundWebhookUrl(): string {
  const trim = (value: string | undefined) => value?.trim().replace(/\/$/, '') || ''
  const fromEnv =
    trim(process.env.NEXT_PUBLIC_APP_URL) ||
    trim(process.env.APP_BASE_URL) ||
    trim(process.env.NEXTAUTH_URL)
  const secret = process.env.APIDAZE_WEBHOOK_SECRET?.trim()
  const suffix = secret ? `?secret=${encodeURIComponent(secret)}` : ''

  if (fromEnv) {
    return `${fromEnv}/api/webhooks/apidaze${suffix}`
  }
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    const base = vercel.startsWith('http') ? vercel : `https://${vercel}`
    return `${base}/api/webhooks/apidaze${suffix}`
  }
  if (process.env.NODE_ENV === 'production') {
    return `https://app.getvantage.tech/api/webhooks/apidaze${suffix}`
  }
  return `http://localhost:3000/api/webhooks/apidaze${suffix}`
}

async function apidazeFetch(
  credentials: ApidazeCredentials,
  path: string,
  init?: RequestInit
): Promise<{ ok: true; status: number; body: string } | { ok: false; status: number; error: string; body: string }> {
  let requestUrl: string
  try {
    requestUrl = buildApidazeRequestUrl(credentials, path)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid URL'
    return {
      ok: false,
      status: 0,
      body: '',
      error: `Could not build Apidaze API URL. Check APIDAZE_API_BASE_URL. ${message}`,
    }
  }

  const response = await fetch(requestUrl, {
    ...init,
    headers: {
      Accept: 'application/xml, application/json, text/xml, */*',
      ...(init?.headers || {}),
    },
  })

  const body = await response.text()
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body,
      error: stripXmlTags(body).slice(0, 400) || `Apidaze request failed (HTTP ${response.status})`,
    }
  }

  return { ok: true, status: response.status, body }
}

export class ApidazeApiClient {
  constructor(
    private readonly credentials: ApidazeCredentials,
    private readonly defaultFromNumber?: string
  ) {}

  async testConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
    const result = await apidazeFetch(this.credentials, '/numbers')
    if (!result.ok) {
      return { ok: false, error: result.error }
    }
    return { ok: true }
  }

  async listPhoneNumbers(): Promise<ApidazePhoneNumber[]> {
    const result = await apidazeFetch(this.credentials, '/numbers')
    if (!result.ok) {
      throw new Error(result.error)
    }
    return parseApidazeNumbersPayload(result.body)
  }

  async sendSms(params: SendSmsParams): Promise<SendSmsResult> {
    const from = params.from || this.defaultFromNumber
    if (!from) {
      return { success: false, error: 'Apidaze requires a From Number assigned to the application.' }
    }
    if (!params.body?.trim()) {
      return { success: false, error: 'Message body is required.' }
    }

    const fromNumber = formatApidazeNumber(from)
    const toNumber = formatApidazeNumber(params.to)
    const formBody = new URLSearchParams({
      from: fromNumber,
      to: toNumber,
      body: params.body,
      message_type: 'SMS',
      num_retries: '3',
    }).toString()
    const jsonBody = JSON.stringify({
      to: toNumber,
      from: fromNumber,
      body: params.body,
      message_type: 'SMS',
      num_retries: 3,
    })

    const bases = Array.from(
      new Set([
        resolveApidazeApiBaseUrl(this.credentials.baseUrl),
        'https://api.apidaze.io',
        'https://api4.apidaze.io',
        DEFAULT_APIDAZE_API_BASE_URL,
      ])
    )

    const attempts: Array<{ base: string; encoding: 'form' | 'json'; body: string; contentType: string }> = []
    for (const base of bases) {
      attempts.push({
        base,
        encoding: 'form',
        body: formBody,
        contentType: 'application/x-www-form-urlencoded',
      })
    }
    attempts.push({
      base: bases[0],
      encoding: 'json',
      body: jsonBody,
      contentType: 'application/json',
    })

    let lastResult: SendSmsResult = { success: false, error: 'Apidaze SMS send failed' }

    try {
      for (const attempt of attempts) {
        const result = await apidazeFetch(
          { ...this.credentials, baseUrl: attempt.base },
          '/sms/send',
          {
            method: 'POST',
            headers: { 'Content-Type': attempt.contentType },
            body: attempt.body,
          }
        )
        const parsed = parseApidazeSendResponse(result.body, result.status)
        console.info('[Apidaze SMS] send attempt', {
          host: attempt.base,
          encoding: attempt.encoding,
          status: result.status,
          success: parsed.success,
          messageId: parsed.messageId || null,
          error: parsed.error || null,
        })
        if (parsed.success) {
          return parsed
        }
        lastResult = parsed
      }

      return lastResult
    } catch (error: unknown) {
      console.error('Apidaze SMS send failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send SMS via Apidaze',
      }
    }
  }
}

export function getApidazePlatformClient(defaultFromNumber?: string): ApidazeApiClient {
  const credentials = getApidazeCredentials()
  if (!credentials) {
    throw new Error(
      'Apidaze is not configured. Set APIDAZE_API_KEY and APIDAZE_API_SECRET on the server.'
    )
  }
  return new ApidazeApiClient(credentials, defaultFromNumber)
}

export async function getApidazeClient(practiceId: string) {
  const { prisma } = await import('@/lib/db')

  if (!isApidazePlatformConfigured()) {
    throw new Error(
      'Apidaze is not configured. Set APIDAZE_API_KEY and APIDAZE_API_SECRET on the server.'
    )
  }

  const integration = await prisma.apidazeIntegration.findFirst({
    where: { practiceId, isActive: true },
  })

  if (!integration?.fromNumber) {
    throw new Error(
      'Apidaze from-number is not configured for this practice. Set it in Settings → Apidaze SMS.'
    )
  }

  return getApidazePlatformClient(integration.fromNumber)
}

export async function findMatchingApidazeIntegrations(toNumbers: string[]): Promise<
  Array<{ practiceId: string; fromNumber: string }>
> {
  const { prisma } = await import('@/lib/db')
  const integrations = await prisma.apidazeIntegration
    .findMany({
      where: { isActive: true },
      select: { practiceId: true, fromNumber: true },
      orderBy: { updatedAt: 'desc' },
    })
    .catch(() => [])

  const matches: Array<{ practiceId: string; fromNumber: string }> = []
  const seen = new Set<string>()
  for (const entry of integrations) {
    if (seen.has(entry.practiceId)) continue
    const matched = toNumbers.some((toNumber) =>
      apidazePhoneNumbersMatch(entry.fromNumber, toNumber)
    )
    if (matched) {
      seen.add(entry.practiceId)
      matches.push(entry)
    }
  }
  return matches
}
