import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as loginGET } from '@/app/api/integrations/ehr/login/route'

vi.mock('@/lib/integrations/ehr/server', () => ({
  resolveEhrPractice: vi.fn().mockResolvedValue({ practiceId: 'practice-1' }),
  getEhrSettings: vi.fn().mockResolvedValue({
    enabledProviders: ['ecw'],
    providerConfigs: {
      ecw: { issuer: 'https://ehr.example.com', clientId: 'client-1' },
    },
  }),
  isIssuerAllowed: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/integrations/ehr/discovery', () => ({
  discoverSmartConfiguration: vi.fn().mockResolvedValue({
    issuer: 'https://ehr.example.com',
    fhirBaseUrl: 'https://ehr.example.com/fhir',
    authorizationEndpoint: 'https://ehr.example.com/auth',
    tokenEndpoint: 'https://ehr.example.com/token',
  }),
}))

describe('EHR login route', () => {
  beforeEach(() => {
    process.env.APP_BASE_URL = 'https://app.example.com'
    process.env.INTEGRATIONS_TOKEN_ENC_KEY = Buffer.from('test-key-32-bytes-long-value!!!!').toString('base64')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to authorization endpoint', async () => {
    const request = new NextRequest(
      'http://localhost/api/integrations/ehr/login?providerId=ecw'
    )
    const response = await loginGET(request)
    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toContain('https://ehr.example.com/auth')
    expect(response.headers.get('set-cookie')).toContain('ehr_oauth')
  })
})
