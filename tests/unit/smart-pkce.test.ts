import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { generatePkce, generateNonce, generateState } from '@/lib/integrations/smart/pkce'

describe('SMART PKCE helpers', () => {
  it('generates verifier and challenge', () => {
    const { codeVerifier, codeChallenge } = generatePkce()
    expect(codeVerifier).toBeTruthy()
    expect(codeChallenge).toBeTruthy()

    const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64')
    const normalized = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    expect(codeChallenge).toBe(normalized)
  })

  it('generates nonce and state', () => {
    const state = generateState()
    const nonce = generateNonce()
    expect(state).toBeTruthy()
    expect(nonce).toBeTruthy()
    expect(state).not.toEqual(nonce)
  })
})
