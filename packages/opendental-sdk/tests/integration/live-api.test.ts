import { describe, it, expect } from 'vitest'

const runIntegration = process.env.OPEN_DENTAL_INTEGRATION_TEST === '1'

describe.runIf(runIntegration)('Open Dental integration (live API)', () => {
  it('validates test credentials against remote API', async () => {
    const { OpenDentalClient, TEST_CREDENTIALS, validateConnection } = await import('../../src/index')
    const client = new OpenDentalClient({
      credentials: TEST_CREDENTIALS,
      baseUrl: process.env.OPEN_DENTAL_DEFAULT_BASE_URL || 'https://api.opendental.com/api/v1',
    })
    const result = await validateConnection(client)
    expect(result.valid).toBe(true)
  })
})

describe.skipIf(runIntegration)('Open Dental integration (skipped)', () => {
  it('requires OPEN_DENTAL_INTEGRATION_TEST=1', () => {
    expect(true).toBe(true)
  })
})
