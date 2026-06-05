/**
 * Telnyx API Client
 *
 * Handles SMS sending and phone number discovery via Telnyx REST API v2.
 * Documentation: https://developers.telnyx.com/docs/messaging/messages/send-message
 */

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

export interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  messagingProfileId?: string
  messagingProfileName?: string
  status?: string
  type?: string
  features: string[]
  messagingReady: boolean
}

interface TelnyxListResponse<T> {
  data: T[]
  meta?: {
    page_number?: number
    total_pages?: number
  }
}

function formatE164(phone: string): string {
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

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '')
}

export function normalizeTelnyxApiKey(apiKey: string): string {
  const trimmed = apiKey.trim()
  if (trimmed.toLowerCase().startsWith('bearer ')) {
    return trimmed.slice(7).trim()
  }
  return trimmed
}

export function isMaskedTelnyxApiKey(apiKey: string): boolean {
  const trimmed = apiKey.trim()
  return trimmed.length === 0 || trimmed.includes('•') || trimmed === '********'
}

function parseTelnyxError(errorBody: string, status: number): string {
  try {
    const parsed = JSON.parse(errorBody) as {
      errors?: Array<{ code?: string; title?: string; detail?: string }>
      error?: { message?: string }
    }
    const err = parsed?.errors?.[0]
    const code = err?.code
    const detail = err?.detail?.trim()
    const title = err?.title?.trim()

    if (
      status === 401 ||
      code === '10009' ||
      code === '20001' ||
      title === 'Authenticate'
    ) {
      return 'Telnyx rejected the API key. In Settings, paste your Telnyx API key (starts with KEY_), not the webhook public key.'
    }

    if (detail && title && detail !== title) {
      return `${title}: ${detail}`
    }

    return detail || title || parsed?.error?.message || 'Telnyx API request failed'
  } catch {
    if (status === 401 || status === 403) {
      return 'Invalid Telnyx API key or insufficient permissions.'
    }
    return 'Telnyx API request failed'
  }
}

async function telnyxFetch<T>(
  apiKey: string,
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const normalizedKey = normalizeTelnyxApiKey(apiKey)
  const response = await fetch(`https://api.telnyx.com/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${normalizedKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    return { ok: false, status: response.status, error: parseTelnyxError(errorBody, response.status) }
  }

  const data = (await response.json()) as T
  return { ok: true, data }
}

async function fetchAllPages<T>(
  apiKey: string,
  path: string,
  pageSize = 250
): Promise<T[]> {
  const results: T[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const separator = path.includes('?') ? '&' : '?'
    const result = await telnyxFetch<TelnyxListResponse<T>>(
      apiKey,
      `${path}${separator}page[number]=${page}&page[size]=${pageSize}`
    )
    if (!result.ok) {
      throw new Error(result.error)
    }
    results.push(...(result.data.data || []))
    totalPages = result.data.meta?.total_pages || 1
    page += 1
  }

  return results
}

export class TelnyxApiClient {
  private apiKey: string
  private defaultFromNumber?: string
  private messagingProfileId?: string

  constructor(
    apiKey: string,
    defaultFromNumber?: string,
    messagingProfileId?: string
  ) {
    this.apiKey = normalizeTelnyxApiKey(apiKey)
    this.defaultFromNumber = defaultFromNumber || undefined
    this.messagingProfileId = messagingProfileId || undefined
  }

  async testConnection(): Promise<boolean> {
    const result = await telnyxFetch<{ data: unknown[] }>(
      this.apiKey,
      '/messaging_phone_numbers?page[size]=1'
    )
    return result.ok
  }

  async listMessagingProfiles(): Promise<Array<{ id: string; name: string }>> {
    const profiles = await fetchAllPages<{ id: string; name: string }>(
      this.apiKey,
      '/messaging_profiles'
    )
    return profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
    }))
  }

  async listPhoneNumbers(): Promise<TelnyxPhoneNumber[]> {
    const [messagingNumbers, allNumbers] = await Promise.all([
      fetchAllPages<{
        id: string
        phone_number: string
        messaging_profile_id?: string
        status?: string
        type?: string
        features?: string[]
      }>(this.apiKey, '/messaging_phone_numbers').catch(() => []),
      fetchAllPages<{
        id: string
        phone_number: string
        status?: string
        phone_number_type?: string
        features?: string[]
      }>(this.apiKey, '/phone_numbers').catch(() => []),
    ])

    const profileNameById = new Map<string, string>()
    try {
      const profiles = await this.listMessagingProfiles()
      for (const profile of profiles) {
        profileNameById.set(profile.id, profile.name)
      }
    } catch {
      // Profile names are optional for the picker UI.
    }

    const byPhone = new Map<string, TelnyxPhoneNumber>()

    for (const entry of allNumbers) {
      const features = entry.features || []
      const messagingReady = features.some((feature) =>
        feature.toLowerCase().includes('sms') || feature.toLowerCase().includes('mms')
      )
      byPhone.set(entry.phone_number, {
        id: entry.id,
        phoneNumber: entry.phone_number,
        status: entry.status,
        type: entry.phone_number_type,
        features,
        messagingReady,
      })
    }

    for (const entry of messagingNumbers) {
      const existing = byPhone.get(entry.phone_number)
      const features = entry.features || existing?.features || []
      byPhone.set(entry.phone_number, {
        id: entry.id || existing?.id || entry.phone_number,
        phoneNumber: entry.phone_number,
        messagingProfileId: entry.messaging_profile_id,
        messagingProfileName: entry.messaging_profile_id
          ? profileNameById.get(entry.messaging_profile_id)
          : undefined,
        status: entry.status || existing?.status,
        type: entry.type || existing?.type,
        features,
        messagingReady: true,
      })
    }

    return Array.from(byPhone.values()).sort((a, b) =>
      a.phoneNumber.localeCompare(b.phoneNumber)
    )
  }

  async sendSms(params: SendSmsParams): Promise<SendSmsResult> {
    const from = params.from || this.defaultFromNumber
    if (!from) {
      return {
        success: false,
        error: 'Telnyx requires a From Number.',
      }
    }

    try {
      const payload: Record<string, string> = {
        from: formatE164(from),
        to: formatE164(params.to),
        text: params.body,
      }
      if (this.messagingProfileId) {
        payload.messaging_profile_id = this.messagingProfileId
      }

      const result = await telnyxFetch<{ data: { id?: string } }>(
        this.apiKey,
        '/messages',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      )

      if (!result.ok) {
        return {
          success: false,
          error: result.error,
        }
      }

      return {
        success: true,
        messageId: result.data.data?.id,
      }
    } catch (error: unknown) {
      console.error('Telnyx SMS send failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send SMS via Telnyx',
      }
    }
  }
}

export function getTelnyxInboundWebhookUrl(): string {
  const trim = (value: string | undefined) => value?.trim().replace(/\/$/, '') || ''
  const fromEnv =
    trim(process.env.NEXT_PUBLIC_APP_URL) ||
    trim(process.env.APP_BASE_URL) ||
    trim(process.env.NEXTAUTH_URL)
  if (fromEnv) {
    return `${fromEnv}/api/webhooks/telnyx`
  }
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    const base = vercel.startsWith('http') ? vercel : `https://${vercel}`
    return `${base}/api/webhooks/telnyx`
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://app.getvantage.tech/api/webhooks/telnyx'
  }
  return 'http://localhost:3000/api/webhooks/telnyx'
}

export async function getTelnyxClient(practiceId: string) {
  const { prisma } = await import('@/lib/db')

  const integration = await prisma.telnyxIntegration.findFirst({
    where: {
      practiceId,
      isActive: true,
    },
  })

  if (!integration?.apiKey || !integration.fromNumber) {
    throw new Error(
      'Telnyx integration not configured or not active. Please configure it in Settings → Telnyx SMS Integration.'
    )
  }

  return new TelnyxApiClient(
    integration.apiKey,
    integration.fromNumber,
    integration.messagingProfileId || undefined
  )
}

export function phoneNumbersMatch(a: string, b: string): boolean {
  const digitsA = normalizePhoneDigits(a)
  const digitsB = normalizePhoneDigits(b)
  if (!digitsA || !digitsB) return false
  return digitsA === digitsB || digitsA.endsWith(digitsB.slice(-10)) || digitsB.endsWith(digitsA.slice(-10))
}
