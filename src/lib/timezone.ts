const DEFAULT_LOCALE = 'en-US'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24

const timezoneCache = new Map<string, { value: string; expiresAt: number }>()

export function normalizeTimeZone(value?: string | null): string | undefined {
  if (!value) return undefined
  try {
    // Throws if timezone is invalid
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return value
  } catch {
    return undefined
  }
}

export function getClientTimeZone(): string | undefined {
  try {
    return normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    return undefined
  }
}

export function getClientLocale(): string | undefined {
  if (typeof navigator === 'undefined') return undefined
  return navigator.language || undefined
}

export function resolveLocale(
  headers: Headers,
  contextLocale?: string | null
): string {
  if (contextLocale) return contextLocale
  const header =
    headers.get('x-user-locale') ||
    headers.get('accept-language') ||
    undefined
  if (!header) return DEFAULT_LOCALE
  return header.split(',')[0]?.trim() || DEFAULT_LOCALE
}

export async function resolveTimeZone(
  headers: Headers,
  contextTimeZone?: string | null
): Promise<string | undefined> {
  const explicit = normalizeTimeZone(contextTimeZone)
  if (explicit) return explicit

  const headerTz = normalizeTimeZone(headers.get('x-user-timezone'))
  if (headerTz) return headerTz

  const vercelTz = normalizeTimeZone(headers.get('x-vercel-ip-timezone'))
  if (vercelTz) return vercelTz

  const ip = extractIp(headers)
  if (!ip || isPrivateIp(ip)) return undefined

  const cached = timezoneCache.get(ip)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const lookup = await lookupTimeZoneFromIp(ip)
  if (lookup) {
    timezoneCache.set(ip, { value: lookup, expiresAt: Date.now() + CACHE_TTL_MS })
  }
  return lookup
}

export function formatDateTime(
  value: string | number | Date,
  options: {
    timeZone?: string
    locale?: string
    dateStyle?: Intl.DateTimeFormatOptions['dateStyle']
    timeStyle?: Intl.DateTimeFormatOptions['timeStyle']
  } = {}
): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'

  const formatter = new Intl.DateTimeFormat(options.locale || DEFAULT_LOCALE, {
    timeZone: options.timeZone,
    dateStyle: options.dateStyle || 'medium',
    timeStyle: options.timeStyle || 'short',
  })
  return formatter.format(date)
}

export function formatDateOnly(
  value: string | number | Date,
  options: {
    timeZone?: string
    locale?: string
    dateStyle?: Intl.DateTimeFormatOptions['dateStyle']
  } = {}
): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  const formatter = new Intl.DateTimeFormat(options.locale || DEFAULT_LOCALE, {
    timeZone: options.timeZone,
    dateStyle: options.dateStyle || 'medium',
  })
  return formatter.format(date)
}

function extractIp(headers: Headers): string | undefined {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim()
  }
  return headers.get('x-real-ip') || undefined
}

function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip === '127.0.0.1') return true
  if (ip.startsWith('10.')) return true
  if (ip.startsWith('192.168.')) return true
  const match = ip.match(/^172\.(\d+)\./)
  if (match) {
    const octet = Number(match[1])
    if (octet >= 16 && octet <= 31) return true
  }
  return false
}

async function lookupTimeZoneFromIp(ip: string): Promise<string | undefined> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timeout)
    if (!response.ok) return undefined
    const data = await response.json()
    return normalizeTimeZone(data?.timezone)
  } catch {
    return undefined
  }
}
