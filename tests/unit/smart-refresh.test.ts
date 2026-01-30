import { describe, it, expect, vi, afterEach } from 'vitest'
import { refreshAccessToken } from '@/lib/integrations/smart/smartClient'

describe('SMART token refresh', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts refresh_token grant to token endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const token = await refreshAccessToken({
      tokenEndpoint: 'https://ehr.example.com/token',
      clientId: 'client-id',
      refreshToken: 'refresh-token',
      scopes: 'openid',
    })

    expect(token.access_token).toBe('new-token')
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('https://ehr.example.com/token')
    expect(options.method).toBe('POST')
    expect(options.body).toContain('grant_type=refresh_token')
    expect(options.body).toContain('refresh_token=refresh-token')
    expect(options.body).toContain('client_id=client-id')
  })
})
