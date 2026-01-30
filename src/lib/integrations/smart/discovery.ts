import { extractSmartOAuthUris } from '@/lib/integrations/fhir/capabilities'

export type SmartDiscoveryResult = {
  issuer: string
  fhirBaseUrl: string
  authorizationEndpoint: string
  tokenEndpoint: string
  revocationEndpoint?: string
}

type SmartConfiguration = {
  issuer?: string
  authorization_endpoint?: string
  token_endpoint?: string
  revocation_endpoint?: string
  fhir_base_url?: string
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeIssuer(issuer: string): string {
  return issuer.replace(/\/+$/g, '')
}

export async function discoverSmartConfiguration(
  issuerInput: string,
  timeoutMs: number = 8000
): Promise<SmartDiscoveryResult> {
  const issuer = normalizeIssuer(issuerInput)

  const wellKnownUrl = `${issuer}/.well-known/smart-configuration`
  const wellKnownResponse = await fetchWithTimeout(wellKnownUrl, timeoutMs)
  if (wellKnownResponse.ok) {
    const wellKnown = (await wellKnownResponse.json()) as SmartConfiguration
    if (!wellKnown.authorization_endpoint || !wellKnown.token_endpoint) {
      throw new Error('SMART configuration missing OAuth endpoints')
    }
    return {
      issuer: wellKnown.issuer ? normalizeIssuer(wellKnown.issuer) : issuer,
      fhirBaseUrl: normalizeIssuer(wellKnown.fhir_base_url || issuer),
      authorizationEndpoint: wellKnown.authorization_endpoint,
      tokenEndpoint: wellKnown.token_endpoint,
      revocationEndpoint: wellKnown.revocation_endpoint,
    }
  }

  const metadataUrl = `${issuer}/metadata`
  const metadataResponse = await fetchWithTimeout(metadataUrl, timeoutMs)
  if (!metadataResponse.ok) {
    throw new Error('SMART discovery failed. Provide issuer base URL and confirm SMART config enabled.')
  }
  const capabilityStatement = await metadataResponse.json()
  const oauthUris = extractSmartOAuthUris(capabilityStatement)
  if (!oauthUris?.authorizationEndpoint || !oauthUris?.tokenEndpoint) {
    throw new Error('SMART discovery failed. OAuth endpoints not found in metadata.')
  }
  return {
    issuer,
    fhirBaseUrl: issuer,
    authorizationEndpoint: oauthUris.authorizationEndpoint,
    tokenEndpoint: oauthUris.tokenEndpoint,
    revocationEndpoint: oauthUris.revocationEndpoint,
  }
}
