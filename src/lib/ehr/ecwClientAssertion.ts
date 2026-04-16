import crypto from 'crypto'

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

/**
 * RS384 signed JWT for eCW OAuth2 client_credentials with
 * `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`.
 * Mirrors the main CRM `createClientAssertion` behavior.
 */
export function createEcwClientAssertionJwt(params: {
  clientId: string
  tokenEndpoint: string
  privateKeyPem: string
  keyId?: string
  audience?: string
}): string {
  const header = {
    alg: 'RS384' as const,
    typ: 'JWT',
    ...(params.keyId ? { kid: params.keyId } : {}),
  }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: params.clientId,
    sub: params.clientId,
    aud: params.audience || params.tokenEndpoint,
    jti: crypto.randomBytes(24).toString('hex'),
    iat: now,
    nbf: now,
    exp: now + 300,
  }

  const headerEncoded = base64UrlEncode(JSON.stringify(header))
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${headerEncoded}.${payloadEncoded}`

  const signer = crypto.createSign('RSA-SHA384')
  signer.update(signingInput)
  signer.end()
  const signature = signer.sign(params.privateKeyPem)
  const signatureEncoded = base64UrlEncode(signature)
  return `${signingInput}.${signatureEncoded}`
}
