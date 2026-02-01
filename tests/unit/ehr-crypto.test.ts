import { describe, it, expect, beforeEach } from 'vitest'
import { encryptString, decryptString } from '@/lib/integrations/ehr/crypto'

describe('EHR crypto helpers', () => {
  beforeEach(() => {
    process.env.INTEGRATIONS_TOKEN_ENC_KEY = Buffer.from(
      'test-key-32-bytes-long-value!!!!'
    ).toString('base64')
  })

  it('round-trips encryption', () => {
    const plaintext = 'secret-token'
    const encrypted = encryptString(plaintext)
    const decrypted = decryptString(encrypted)
    expect(decrypted).toBe(plaintext)
  })
})
