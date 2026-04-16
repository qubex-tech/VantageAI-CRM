import { createEcwClientAssertionJwt } from '@/lib/ehr/ecwClientAssertion'
import { prisma } from '@/lib/db'

type SmartConfig = {
  token_endpoint?: string
}

let cachedToken: { cacheKey: string; accessToken: string; expiresAtMs: number } | null = null

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

/** Org / tenant segment for multitenant eCW FHIR (e.g. FACGCD, FFBJCD). */
function getEcwTenantSegment(): string | undefined {
  return pickEnv('VANTAGE_ECW_TENANT', 'EHR_ECW_TENANT', 'ECW_TENANT')?.replace(/^\/+|\/+$/g, '')
}

/** True when pathname is exactly /fhir/r4 (no tenant after R4). */
function fhirBaseMissingEcwTenantPath(fhirBaseUrl: string): boolean {
  try {
    const path = new URL(trimTrailingSlash(fhirBaseUrl)).pathname.replace(/\/+$/, '')
    return /\/fhir\/r4$/i.test(path)
  } catch {
    return false
  }
}

/**
 * eCW serves FHIR and SMART metadata under …/fhir/r4/{TENANT}.
 * If the configured base stops at …/fhir/r4, append EHR_ECW_TENANT / VANTAGE_ECW_TENANT when set (eCW hosts only).
 */
export function resolveEcwFhirBaseUrl(raw: string | undefined | null): string {
  if (!raw?.trim()) return ''
  let base = trimTrailingSlash(raw.trim())
  const tenant = getEcwTenantSegment()
  if (!tenant) return base
  let hostname = ''
  try {
    hostname = new URL(base).hostname.toLowerCase()
  } catch {
    return base
  }
  const isLikelyEcw =
    hostname.includes('eclinicalworks.com') ||
    hostname.includes('ecwcloud.com') ||
    hostname.includes('healow.com')
  if (!isLikelyEcw || !fhirBaseMissingEcwTenantPath(base)) return base
  return `${base}/${tenant}`
}

/** Backend eCW row for this practice (issuer + FHIR base from connect flow). */
async function loadDocumentationEhrConnection(practiceId: string | undefined) {
  if (!practiceId) return null
  return prisma.ehrConnection.findFirst({
    where: {
      tenantId: practiceId,
      authFlow: 'backend_services',
      providerId: { in: ['ecw_write', 'ecw'] },
    },
    orderBy: { updatedAt: 'desc' },
    select: { fhirBaseUrl: true, issuer: true, clientId: true },
  })
}

async function resolveDocumentationFhirClient(practiceId?: string): Promise<{
  fhirBase: string
  clientId: string | undefined
  fhirRaw: string | undefined
}> {
  const row = await loadDocumentationEhrConnection(practiceId)
  const fhirRaw = row?.fhirBaseUrl?.trim() || row?.issuer?.trim() || getEcwFhirBaseUrl()
  const fhirBase = resolveEcwFhirBaseUrl(fhirRaw || null)
  const clientId = row?.clientId?.trim() || getEcwClientId()
  return { fhirBase, clientId, fhirRaw }
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
export async function getEcwDocumentationConfigGaps(practiceId?: string): Promise<string[]> {
  const gaps: string[] = []
  const { fhirBase, clientId, fhirRaw } = await resolveDocumentationFhirClient(practiceId)
  if (!fhirRaw?.trim()) {
    gaps.push(
      'Missing FHIR base URL. Set VANTAGE_ECW_FHIR_BASE_URL / EHR_ECW_FHIR_BASE_URL in Vercel, or connect Backend eCW for this practice so fhirBaseUrl / issuer is stored (EhrConnection).'
    )
  } else if (fhirBaseMissingEcwTenantPath(fhirBase)) {
    gaps.push(
      'FHIR base URL ends at /fhir/r4 without an organization segment. Use …/fhir/r4/{TENANT}, set VANTAGE_ECW_TENANT / EHR_ECW_TENANT, or save the full FHIR base when connecting eCW for this practice.'
    )
  }
  if (!clientId?.trim()) {
    gaps.push(
      'Missing OAuth client id. Set VANTAGE_ECW_CLIENT_ID / EHR_ECW_CLIENT_ID in Vercel, or store it on the practice Backend eCW connection.'
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

export async function isEcwDocumentationConfigured(practiceId?: string): Promise<boolean> {
  const gaps = await getEcwDocumentationConfigGaps(practiceId)
  return gaps.length === 0
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

  const base = trimTrailingSlash(fhirBaseUrl)
  if (fhirBaseMissingEcwTenantPath(base)) {
    throw new Error(
      `eCW FHIR base must include the tenant after /fhir/r4 (e.g. https://fhir4.eclinicalworks.com/fhir/r4/FACGCD). ` +
        `Got "${base}", which requests SMART metadata at …/fhir/r4/.well-known/smart-configuration and typically returns 400. ` +
        `Append your org id to the URL or set VANTAGE_ECW_TENANT / EHR_ECW_TENANT.`
    )
  }

  const wellKnown = `${base}/.well-known/smart-configuration`
  const res = await fetch(wellKnown, { method: 'GET', cache: 'no-store' })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    const r4WellKnown =
      /\/fhir\/r4\/\.well-known\//i.test(wellKnown) || /\/r4\/\.well-known\//i.test(wellKnown)
    const hint = r4WellKnown
      ? ' This URL usually means the FHIR base is missing the /{TENANT} segment after /fhir/r4.'
      : ''
    throw new Error(`Could not load SMART configuration from ${wellKnown} (${res.status}).${hint} ${errText.slice(0, 200)}`)
  }
  const json = (await res.json()) as SmartConfig
  if (!json.token_endpoint) {
    throw new Error('SMART configuration missing token_endpoint')
  }
  return json.token_endpoint
}

async function fetchAccessToken(practiceId?: string): Promise<string> {
  const staticToken = getStaticAccessToken()
  if (staticToken) return staticToken

  const { fhirBase, clientId } = await resolveDocumentationFhirClient(practiceId)
  const clientSecret = getEcwClientSecret()
  const privateKeyPem = readJwtPrivateKeyFromEnv()

  if (!fhirBase || !clientId) {
    throw new Error(
      'Vantage ECW documentation is not configured (FHIR base + client id from Vercel env or practice EhrConnection)'
    )
  }
  if (!clientSecret && !privateKeyPem) {
    throw new Error(
      'Vantage ECW auth: set client secret or JWT private key (VANTAGE_* or EHR_JWT_PRIVATE_KEY / EHR_ECW_CLIENT_SECRET)'
    )
  }

  const now = Date.now()
  const cacheKey = `${fhirBase}::${clientId}`
  if (cachedToken?.cacheKey === cacheKey && cachedToken.expiresAtMs > now + 15_000) {
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
    cacheKey,
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
  externalPatientId: string,
  practiceId?: string
): Promise<{ raw: FhirBundle; patientParam: string }> {
  const { fhirBase } = await resolveDocumentationFhirClient(practiceId)
  if (!fhirBase) {
    throw new Error('FHIR base URL is not set (env or practice EhrConnection)')
  }

  const token = await fetchAccessToken(practiceId)
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
