import { createEcwClientAssertionJwt } from '@/lib/ehr/ecwClientAssertion'

type SmartConfig = {
  token_endpoint?: string
}

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null

/** First non-empty trimmed value among env keys (Vantage-specific names first, then shared Medical CRM names). */
function pickEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = process.env[key]?.trim()
    if (v) return v
  }
  return undefined
}

function getEcwFhirBaseUrl(): string | undefined {
  return pickEnv('VANTAGE_ECW_FHIR_BASE_URL', 'EHR_ECW_FHIR_BASE_URL', 'ECW_FHIR_BASE_URL')
}

function getEcwClientId(): string | undefined {
  return pickEnv('VANTAGE_ECW_CLIENT_ID', 'EHR_ECW_CLIENT_ID', 'ECW_CLIENT_ID')
}

function getEcwClientSecret(): string | undefined {
  return pickEnv('VANTAGE_ECW_CLIENT_SECRET', 'EHR_ECW_CLIENT_SECRET', 'ECW_CLIENT_SECRET')
}

function getStaticAccessToken(): string | undefined {
  return pickEnv('VANTAGE_ECW_STATIC_ACCESS_TOKEN', 'EHR_ECW_STATIC_ACCESS_TOKEN')
}

function getTokenUrlOverride(): string | undefined {
  return pickEnv('VANTAGE_ECW_TOKEN_URL', 'EHR_ECW_TOKEN_URL', 'EHR_TOKEN_URL')
}

function getScopeOverride(): string | undefined {
  return pickEnv('VANTAGE_ECW_SCOPE', 'EHR_ECW_SCOPE')
}

function getJwtKeyId(): string | undefined {
  return pickEnv('VANTAGE_ECW_JWT_KEY_ID', 'EHR_JWT_KEY_ID')
}

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
 * PEM from Vantage or shared CRM env names, or UTF-8 PEM decoded from base64 vars (Vercel-friendly).
 * Accepts: VANTAGE_ECW_JWT_PRIVATE_KEY, EHR_JWT_PRIVATE_KEY (same as main Medical CRM), and _BASE64 variants.
 */
export function readJwtPrivateKeyFromEnv(): string | null {
  const pemKeys = ['VANTAGE_ECW_JWT_PRIVATE_KEY', 'EHR_JWT_PRIVATE_KEY'] as const
  for (const key of pemKeys) {
    const fromPem = normalizePrivateKeyPem(process.env[key])
    if (fromPem?.includes('BEGIN')) return fromPem
  }
  const b64Keys = ['VANTAGE_ECW_JWT_PRIVATE_KEY_BASE64', 'EHR_JWT_PRIVATE_KEY_BASE64'] as const
  for (const key of b64Keys) {
    const b64 = process.env[key]?.trim()
    if (!b64) continue
    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf8')
      const normalized = normalizePrivateKeyPem(decoded)
      if (normalized?.includes('BEGIN')) return normalized
    } catch {
      /* ignore */
    }
  }
  return null
}

/** Which pieces are still missing on the server (for operator debugging; no secret values). */
export function getEcwDocumentationConfigGaps(): string[] {
  const gaps: string[] = []
  if (!getEcwFhirBaseUrl()) {
    gaps.push(
      'Missing FHIR base URL. Set VANTAGE_ECW_FHIR_BASE_URL (preferred) or EHR_ECW_FHIR_BASE_URL / ECW_FHIR_BASE_URL (e.g. https://fhir4.eclinicalworks.com/fhir/r4/FACGCD).'
    )
  }
  if (!getEcwClientId()) {
    gaps.push(
      'Missing OAuth client id. Set VANTAGE_ECW_CLIENT_ID (preferred) or EHR_ECW_CLIENT_ID / ECW_CLIENT_ID.'
    )
  }
  const secret = getEcwClientSecret()
  const staticTok = getStaticAccessToken()
  const jwtPemSet = Boolean(
    process.env.VANTAGE_ECW_JWT_PRIVATE_KEY?.trim() || process.env.EHR_JWT_PRIVATE_KEY?.trim()
  )
  const jwtB64Set = Boolean(
    process.env.VANTAGE_ECW_JWT_PRIVATE_KEY_BASE64?.trim() || process.env.EHR_JWT_PRIVATE_KEY_BASE64?.trim()
  )
  const jwtMaterial = readJwtPrivateKeyFromEnv()
  if (!secret && !staticTok && !jwtMaterial) {
    if (jwtPemSet || jwtB64Set) {
      gaps.push(
        'JWT private key env is set but did not parse as a PEM (fix newlines in EHR_JWT_PRIVATE_KEY / VANTAGE_ECW_JWT_PRIVATE_KEY, or use EHR_JWT_PRIVATE_KEY_BASE64 / VANTAGE_ECW_JWT_PRIVATE_KEY_BASE64 with base64-of-UTF-8-PEM).'
      )
    } else {
      gaps.push(
        'Missing credential: set VANTAGE_ECW_CLIENT_SECRET or EHR_ECW_CLIENT_SECRET, or JWT PEM in EHR_JWT_PRIVATE_KEY / VANTAGE_ECW_JWT_PRIVATE_KEY (or a *_BASE64 variant), or VANTAGE_ECW_STATIC_ACCESS_TOKEN for local testing.'
      )
    }
  }
  return gaps
}

/** OAuth JWT `aud` for client assertion; eCW often requires a fixed audience per environment. */
function clientAssertionAudience(fhirBaseUrl: string): string | undefined {
  const defaultAud = pickEnv('VANTAGE_ECW_CLIENT_ASSERTION_AUD', 'EHR_ECW_CLIENT_ASSERTION_AUD')
  const prodAud = pickEnv('VANTAGE_ECW_CLIENT_ASSERTION_AUD_PROD', 'EHR_ECW_CLIENT_ASSERTION_AUD_PROD')
  const sandboxAud = pickEnv('VANTAGE_ECW_CLIENT_ASSERTION_AUD_SANDBOX', 'EHR_ECW_CLIENT_ASSERTION_AUD_SANDBOX')
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
  const explicit = getTokenUrlOverride()
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
  const staticToken = getStaticAccessToken()
  if (staticToken) return staticToken

  const fhirBase = getEcwFhirBaseUrl()
  const clientId = getEcwClientId()
  const clientSecret = getEcwClientSecret()
  const privateKeyPem = readJwtPrivateKeyFromEnv()

  if (!fhirBase || !clientId) {
    throw new Error(
      'Vantage ECW documentation is not configured (set VANTAGE_ECW_FHIR_BASE_URL or EHR_ECW_FHIR_BASE_URL, and VANTAGE_ECW_CLIENT_ID or EHR_ECW_CLIENT_ID)'
    )
  }
  if (!clientSecret && !privateKeyPem) {
    throw new Error(
      'Vantage ECW auth: set client secret or JWT private key (VANTAGE_* or EHR_JWT_PRIVATE_KEY / EHR_ECW_CLIENT_SECRET)'
    )
  }

  const now = Date.now()
  if (cachedToken && cachedToken.expiresAtMs > now + 15_000) {
    return cachedToken.accessToken
  }

  const tokenEndpoint = await discoverTokenEndpoint(fhirBase)
  const scope =
    getScopeOverride() || 'system/DocumentReference.read system/Patient.read'

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
      keyId: getJwtKeyId(),
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
  const fhirBase = getEcwFhirBaseUrl()
  if (!fhirBase) {
    throw new Error('FHIR base URL is not set (VANTAGE_ECW_FHIR_BASE_URL or EHR_ECW_FHIR_BASE_URL)')
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
