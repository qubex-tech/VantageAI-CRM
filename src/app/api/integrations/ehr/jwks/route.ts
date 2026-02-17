import { NextResponse } from 'next/server'
import crypto from 'crypto'

function getJwks() {
  const privateKeyPem = process.env.EHR_JWT_PRIVATE_KEY
  if (!privateKeyPem) {
    return null
  }
  const key = crypto.createPrivateKey(privateKeyPem)
  const publicKey = crypto.createPublicKey(key)
  const jwk = publicKey.export({ format: 'jwk' }) as JsonWebKey
  const kid = process.env.EHR_JWT_KEY_ID

  return {
    keys: [
      {
        ...jwk,
        kid,
        use: 'sig',
        alg: 'RS256',
      },
    ],
  }
}

export async function GET() {
  const jwks = getJwks()
  if (!jwks) {
    return NextResponse.json({ error: 'JWKS not configured' }, { status: 404 })
  }
  return NextResponse.json(jwks)
}
