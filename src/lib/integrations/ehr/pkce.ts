import crypto from 'crypto'

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export function generateRandomString(bytes: number = 32): string {
  return base64UrlEncode(crypto.randomBytes(bytes))
}

export function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = generateRandomString(64)
  const hash = crypto.createHash('sha256').update(codeVerifier).digest()
  const codeChallenge = base64UrlEncode(hash)
  return { codeVerifier, codeChallenge }
}

export function generateState(): string {
  return generateRandomString(32)
}

export function generateNonce(): string {
  return generateRandomString(32)
}
