import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as loginGET } from '@/app/api/integrations/smart/login/route'

vi.mock('@/lib/integrations/smart/server', () => ({
  requireSmartUser: vi.fn().mockResolvedValue({ practiceId: 'practice-1' }),
  getSmartSettings: vi.fn().mockResolvedValue({ enabled: true }),
  getSmartDefaultScopes: vi.fn().mockReturnValue('openid'),
  isIssuerAllowed: vi.fn().mockReturnValue(true),
  shouldEnableWrite: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/integrations/smart/discovery', () => ({
  discoverSmartConfiguration: vi.fn().mockResolvedValue({
    issuer: 'https://ehr.example.com',
    fhirBaseUrl: 'https://ehr.example.com/fhir',
    authorizationEndpoint: 'https://ehr.example.com/auth',
    tokenEndpoint: 'https://ehr.example.com/token',
  }),
}))

describe('SMART login route', () => {
  beforeEach(() => {
    process.env.APP_BASE_URL = 'https://app.example.com'
    process.env.INTEGRATIONS_TOKEN_ENC_KEY = Buffer.from('test-key-32-bytes-long-value!!!!').toString('base64')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to authorization endpoint', async () => {
    const request = new NextRequest(
      'http://localhost/api/integrations/smart/login?issuer=https://ehr.example.com&clientId=client-1'
    )
    const response = await loginGET(request)
    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toContain('https://ehr.example.com/auth')
    expect(response.headers.get('set-cookie')).toContain('smart_fhir_oauth')
  })

  it('returns 400 when issuer missing', async () => {
    const { getSmartSettings } = await import('@/lib/integrations/smart/server')
    ;(getSmartSettings as any).mockResolvedValueOnce(null)

    const request = new NextRequest('http://localhost/api/integrations/smart/login')
    const response = await loginGET(request)
    expect(response.status).toBe(400)
  })
})
