import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getJwks() {
  const privateKeyPem = process.env.EHR_JWT_PRIVATE_KEY
  if (!privateKeyPem) {
    return null
  }
  let jwk: JsonWebKey
  try {
    const key = crypto.createPrivateKey(privateKeyPem)
    const publicKey = crypto.createPublicKey(key)
    jwk = publicKey.export({ format: 'jwk' }) as JsonWebKey
  } catch (error) {
    return { error: 'Invalid private key format' }
  }
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
  if ('error' in jwks) {
    return NextResponse.json({ error: jwks.error }, { status: 500 })
  }
  return NextResponse.json(jwks)
}
