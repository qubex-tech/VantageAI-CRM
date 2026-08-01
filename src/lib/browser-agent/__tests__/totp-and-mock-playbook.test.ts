import { describe, expect, it } from 'vitest'
import { generateTotp } from '../totp'
import { availityEligibilityPlaybook } from '../playbooks/availity-eligibility'
import { smokePlaybook } from '../playbooks/smoke'

describe('generateTotp', () => {
  it('returns a 6-digit code for a known secret', () => {
    // RFC 6238 test vector style — secret "12345678901234567890" in base32 is often used;
    // here we just assert format/stability for a fixed timestamp.
    const secret = 'JBSWY3DPEHPK3PXP' // "Hello!"
    const code = generateTotp(secret, 0)
    expect(code).toMatch(/^\d{6}$/)
    expect(generateTotp(secret, 0)).toBe(code)
  })
})

describe('playbooks mock mode', () => {
  it('smoke playbook returns mock output', async () => {
    const result = await smokePlaybook.run({
      practiceId: 'p1',
      runId: 'r1',
      credential: null,
      useMock: true,
      input: {},
      session: null,
      log: () => undefined,
    })
    expect(result.ok).toBe(true)
    expect(result.output?.mock).toBe(true)
  })

  it('availity eligibility playbook returns active mock summary', async () => {
    const result = await availityEligibilityPlaybook.run({
      practiceId: 'p1',
      runId: 'r1',
      credential: null,
      useMock: true,
      input: {
        payerName: 'Aetna',
        memberId: 'M123',
      },
      session: null,
      log: () => undefined,
    })
    expect(result.ok).toBe(true)
    expect((result.output?.summary as { eligibilityStatus: string }).eligibilityStatus).toBe(
      'active'
    )
  })
})
