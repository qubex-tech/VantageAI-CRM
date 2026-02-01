import { generateNonce, generatePkce, generateState } from './pkce'

export type SmartLaunchContext = {
  providerId: string
  issuer: string
  fhirBaseUrl: string
  clientId: string
  clientSecret?: string
  authorizationEndpoint: string
  tokenEndpoint: string
  revocationEndpoint?: string
  scopes: string
  state: string
  nonce: string
  codeChallenge: string
  codeVerifier: string
  launch?: string
  practiceId: string
}

export type TokenResponse = {
  access_token: string
  refresh_token?: string
  id_token?: string
  token_type?: string
  expires_in?: number
  scope?: string
  patient?: string
  encounter?: string
  fhirUser?: string
}

export type IdTokenPayload = {
  sub?: string
  nonce?: string
  fhirUser?: string
  profile?: string
  patient?: string
  encounter?: string
  [key: string]: unknown
}

export function buildAuthorizationUrl(params: {
  authorizationEndpoint: string
  clientId: string
  redirectUri: string
  scopes: string
  state: string
  nonce: string
  codeChallenge: string
  aud: string
  launch?: string
}): string {
  const url = new URL(params.authorizationEndpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('scope', params.scopes)
  url.searchParams.set('state', params.state)
  url.searchParams.set('aud', params.aud)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('nonce', params.nonce)
  if (params.launch) {
    url.searchParams.set('launch', params.launch)
  }
  return url.toString()
}

export function createLaunchContext(input: {
  providerId: string
  issuer: string
  fhirBaseUrl: string
  clientId: string
  clientSecret?: string
  authorizationEndpoint: string
  tokenEndpoint: string
  revocationEndpoint?: string
  scopes: string
  practiceId: string
  launch?: string
}): SmartLaunchContext {
  const { codeVerifier, codeChallenge } = generatePkce()
  return {
    providerId: input.providerId,
    issuer: input.issuer,
    fhirBaseUrl: input.fhirBaseUrl,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    authorizationEndpoint: input.authorizationEndpoint,
    tokenEndpoint: input.tokenEndpoint,
    revocationEndpoint: input.revocationEndpoint,
    scopes: input.scopes,
    state: generateState(),
    nonce: generateNonce(),
    codeChallenge,
    codeVerifier,
    launch: input.launch,
    practiceId: input.practiceId,
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export async function exchangeAuthorizationCode(params: {
  tokenEndpoint: string
  clientId: string
  clientSecret?: string
  code: string
  redirectUri: string
  codeVerifier: string
  timeoutMs?: number
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
  })
  if (params.clientSecret) {
    body.set('client_secret', params.clientSecret)
  }

  const response = await fetchWithTimeout(
    params.tokenEndpoint,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
    params.timeoutMs ?? 10000
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token exchange failed: ${errorText}`)
  }

  return (await response.json()) as TokenResponse
}

export async function refreshAccessToken(params: {
  tokenEndpoint: string
  clientId: string
  clientSecret?: string
  refreshToken: string
  scopes?: string
  timeoutMs?: number
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
    client_id: params.clientId,
  })
  if (params.scopes) {
    body.set('scope', params.scopes)
  }
  if (params.clientSecret) {
    body.set('client_secret', params.clientSecret)
  }

  const response = await fetchWithTimeout(
    params.tokenEndpoint,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
    params.timeoutMs ?? 10000
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token refresh failed: ${errorText}`)
  }

  return (await response.json()) as TokenResponse
}

export async function revokeToken(params: {
  revocationEndpoint: string
  token: string
  clientId: string
  clientSecret?: string
  timeoutMs?: number
}): Promise<void> {
  const body = new URLSearchParams({
    token: params.token,
    client_id: params.clientId,
  })
  if (params.clientSecret) {
    body.set('client_secret', params.clientSecret)
  }
  const response = await fetchWithTimeout(
    params.revocationEndpoint,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
    params.timeoutMs ?? 8000
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token revocation failed: ${errorText}`)
  }
}

export function decodeIdToken(token: string): IdTokenPayload {
  const parts = token.split('.')
  if (parts.length < 2) {
    throw new Error('Invalid id_token')
  }
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const padded = payload.length % 4 === 0 ? payload : payload + '='.repeat(4 - (payload.length % 4))
  const json = Buffer.from(padded, 'base64').toString('utf8')
  return JSON.parse(json) as IdTokenPayload
}

export function assertNonce(payload: IdTokenPayload, expectedNonce: string) {
  if (payload.nonce && payload.nonce !== expectedNonce) {
    throw new Error('Invalid nonce in id_token')
  }
}
