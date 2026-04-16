type SmartConfig = {
  token_endpoint?: string
}

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export function isEcwDocumentationConfigured(): boolean {
  const base = process.env.VANTAGE_ECW_FHIR_BASE_URL?.trim()
  const clientId = process.env.VANTAGE_ECW_CLIENT_ID?.trim()
  const secret = process.env.VANTAGE_ECW_CLIENT_SECRET?.trim()
  const staticToken = process.env.VANTAGE_ECW_STATIC_ACCESS_TOKEN?.trim()
  return Boolean(base && clientId && (secret || staticToken))
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
  if (!fhirBase || !clientId || !clientSecret) {
    throw new Error('Vantage ECW documentation is not configured (FHIR base, client id, and client secret required)')
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
    client_secret: clientSecret,
    scope,
  })

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
