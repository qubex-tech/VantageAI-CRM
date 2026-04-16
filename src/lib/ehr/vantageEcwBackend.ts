import { createEcwClientAssertionJwt } from '@/lib/ehr/ecwClientAssertion'

type SmartConfig = {
  token_endpoint?: string
}

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

function normalizePrivateKeyPem(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  const normalized = raw
    .trim()
    .replace(/^"+|"+$/g, '')
    .replace(/^'+|'+$/g, '')
    .replace(/\\r/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
  return normalized || null
}

/**
 * PEM from `VANTAGE_ECW_JWT_PRIVATE_KEY`, or UTF-8 PEM decoded from
 * `VANTAGE_ECW_JWT_PRIVATE_KEY_BASE64` (recommended on Vercel for multiline keys).
 */
export function readJwtPrivateKeyFromEnv(): string | null {
  const fromPem = normalizePrivateKeyPem(process.env.VANTAGE_ECW_JWT_PRIVATE_KEY)
  if (fromPem?.includes('BEGIN')) return fromPem
  const b64 = process.env.VANTAGE_ECW_JWT_PRIVATE_KEY_BASE64?.trim()
  if (b64) {
    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf8')
      const normalized = normalizePrivateKeyPem(decoded)
      if (normalized?.includes('BEGIN')) return normalized
    } catch {
      /* ignore */
    }
  }
  return fromPem?.includes('BEGIN') ? fromPem : null
}

/** Which pieces are still missing on the server (for operator debugging; no secret values). */
export function getEcwDocumentationConfigGaps(): string[] {
  const gaps: string[] = []
  if (!process.env.VANTAGE_ECW_FHIR_BASE_URL?.trim()) {
    gaps.push('Missing VANTAGE_ECW_FHIR_BASE_URL (e.g. https://fhir4.eclinicalworks.com/fhir/r4/FACGCD).')
  }
  if (!process.env.VANTAGE_ECW_CLIENT_ID?.trim()) {
    gaps.push('Missing VANTAGE_ECW_CLIENT_ID.')
  }
  const secret = process.env.VANTAGE_ECW_CLIENT_SECRET?.trim()
  const staticTok = process.env.VANTAGE_ECW_STATIC_ACCESS_TOKEN?.trim()
  const jwtPemSet = Boolean(process.env.VANTAGE_ECW_JWT_PRIVATE_KEY?.trim())
  const jwtB64Set = Boolean(process.env.VANTAGE_ECW_JWT_PRIVATE_KEY_BASE64?.trim())
  const jwtMaterial = readJwtPrivateKeyFromEnv()
  if (!secret && !staticTok && !jwtMaterial) {
    if (jwtPemSet || jwtB64Set) {
      gaps.push(
        'JWT key env is set but did not parse as a PEM (use real newlines in VANTAGE_ECW_JWT_PRIVATE_KEY, or put base64-of-UTF-8-PEM in VANTAGE_ECW_JWT_PRIVATE_KEY_BASE64).'
      )
    } else {
      gaps.push(
        'Missing credential: set VANTAGE_ECW_CLIENT_SECRET and/or VANTAGE_ECW_JWT_PRIVATE_KEY (or VANTAGE_ECW_JWT_PRIVATE_KEY_BASE64), or VANTAGE_ECW_STATIC_ACCESS_TOKEN for local testing.'
      )
    }
  }
  return gaps
}

/** OAuth JWT `aud` for client assertion; eCW often requires a fixed audience per environment. */
function clientAssertionAudience(fhirBaseUrl: string): string | undefined {
  const defaultAud = process.env.VANTAGE_ECW_CLIENT_ASSERTION_AUD?.trim()
  const prodAud = process.env.VANTAGE_ECW_CLIENT_ASSERTION_AUD_PROD?.trim()
  const sandboxAud = process.env.VANTAGE_ECW_CLIENT_ASSERTION_AUD_SANDBOX?.trim()
  const n = fhirBaseUrl.toLowerCase()
  const isSandbox = n.includes('staging') || n.includes('ecwcloud.com')
  const isProd = n.includes('eclinicalworks.com')
  if (isProd && prodAud) return prodAud
  if (isSandbox && sandboxAud) return sandboxAud
  return defaultAud || (isProd ? prodAud : sandboxAud) || undefined
}

export function isEcwDocumentationConfigured(): boolean {
  return getEcwDocumentationConfigGaps().length === 0
}

function patientQueryParam(externalEhrId: string): string {
  const raw = externalEhrId.trim()
  if (raw.startsWith('Patient/')) {
    return raw.slice('Patient/'.length).split('|')[0] || raw
  }
  return raw
}

async function discoverTokenEndpoint(fhirBaseUrl: string): Promise<string> {
  const explicit = process.env.VANTAGE_ECW_TOKEN_URL?.trim()
  if (explicit) return explicit

  const wellKnown = `${trimTrailingSlash(fhirBaseUrl)}/.well-known/smart-configuration`
  const res = await fetch(wellKnown, { method: 'GET', cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Could not load SMART configuration from ${wellKnown} (${res.status})`)
  }
  const json = (await res.json()) as SmartConfig
  if (!json.token_endpoint) {
    throw new Error('SMART configuration missing token_endpoint')
  }
  return json.token_endpoint
}

async function fetchAccessToken(): Promise<string> {
  const staticToken = process.env.VANTAGE_ECW_STATIC_ACCESS_TOKEN?.trim()
  if (staticToken) return staticToken

  const fhirBase = process.env.VANTAGE_ECW_FHIR_BASE_URL?.trim()
  const clientId = process.env.VANTAGE_ECW_CLIENT_ID?.trim()
  const clientSecret = process.env.VANTAGE_ECW_CLIENT_SECRET?.trim()
  const privateKeyPem = readJwtPrivateKeyFromEnv()

  if (!fhirBase || !clientId) {
    throw new Error(
      'Vantage ECW documentation is not configured (set VANTAGE_ECW_FHIR_BASE_URL and VANTAGE_ECW_CLIENT_ID)'
    )
  }
  if (!clientSecret && !privateKeyPem) {
    throw new Error(
      'Vantage ECW auth: set VANTAGE_ECW_CLIENT_SECRET and/or VANTAGE_ECW_JWT_PRIVATE_KEY (PEM) or VANTAGE_ECW_JWT_PRIVATE_KEY_BASE64 for client_credentials'
    )
  }

  const now = Date.now()
  if (cachedToken && cachedToken.expiresAtMs > now + 15_000) {
    return cachedToken.accessToken
  }

  const tokenEndpoint = await discoverTokenEndpoint(fhirBase)
  const scope =
    process.env.VANTAGE_ECW_SCOPE?.trim() ||
    'system/DocumentReference.read system/Patient.read'

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    scope,
  })

  if (privateKeyPem) {
    const assertion = createEcwClientAssertionJwt({
      clientId,
      tokenEndpoint,
      privateKeyPem,
      keyId: process.env.VANTAGE_ECW_JWT_KEY_ID?.trim(),
      audience: clientAssertionAudience(fhirBase),
    })
    body.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer')
    body.set('client_assertion', assertion)
  } else if (clientSecret) {
    body.set('client_secret', clientSecret)
  }

  const tokenRes = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '')
    throw new Error(`ECW token request failed (${tokenRes.status}): ${errText.slice(0, 500)}`)
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token: string
    expires_in?: number
  }
  if (!tokenJson.access_token) {
    throw new Error('ECW token response missing access_token')
  }

  const ttlSec = typeof tokenJson.expires_in === 'number' ? tokenJson.expires_in : 300
  cachedToken = {
    accessToken: tokenJson.access_token,
    expiresAtMs: Date.now() + Math.max(60, ttlSec - 30) * 1000,
  }
  return cachedToken.accessToken
}

type FhirBundle = {
  resourceType?: string
  type?: string
  entry?: Array<Record<string, unknown>>
  link?: Array<{ relation?: string; url?: string }>
}

export async function fetchPatientDocumentReferences(
  externalPatientId: string
): Promise<{ raw: FhirBundle; patientParam: string }> {
  const fhirBase = process.env.VANTAGE_ECW_FHIR_BASE_URL?.trim()
  if (!fhirBase) {
    throw new Error('VANTAGE_ECW_FHIR_BASE_URL is not set')
  }

  const token = await fetchAccessToken()
  const patientParam = patientQueryParam(externalPatientId)

  const search = new URLSearchParams()
  search.set('patient', patientParam)
  search.set('category', 'clinical-note')
  search.set('_count', '100')

  const firstUrl = `${trimTrailingSlash(fhirBase)}/DocumentReference?${search.toString()}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/fhir+json',
  }

  const merged: FhirBundle = {
    resourceType: 'Bundle',
    type: 'searchset',
    entry: [],
  }

  let pageUrl: string | null = firstUrl
  const seenUrls = new Set<string>()
  for (let page = 0; page < 5 && pageUrl; page++) {
    if (seenUrls.has(pageUrl)) break
    seenUrls.add(pageUrl)

    const res = await fetch(pageUrl, {
      headers,
      cache: 'no-store',
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`DocumentReference search failed (${res.status}): ${errText.slice(0, 800)}`)
    }

    const pageBundle = (await res.json()) as FhirBundle
    if (Array.isArray(pageBundle.entry)) {
      merged.entry!.push(...pageBundle.entry)
    }
    const nextLink = (pageBundle.link || []).find((l) => l.relation === 'next')?.url
    pageUrl = nextLink && !seenUrls.has(nextLink) ? nextLink : null
  }

  return { raw: merged, patientParam }
}
