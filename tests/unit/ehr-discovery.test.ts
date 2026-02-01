import { describe, it, expect, vi, afterEach } from 'vitest'
import { discoverSmartConfiguration } from '@/lib/integrations/ehr/discovery'

describe('EHR discovery', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses well-known when available', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        issuer: 'https://ehr.example.com',
        authorization_endpoint: 'https://ehr.example.com/auth',
        token_endpoint: 'https://ehr.example.com/token',
        revocation_endpoint: 'https://ehr.example.com/revoke',
        fhir_base_url: 'https://ehr.example.com/fhir',
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const config = await discoverSmartConfiguration('https://ehr.example.com')
    expect(config.authorizationEndpoint).toBe('https://ehr.example.com/auth')
    expect(config.tokenEndpoint).toBe('https://ehr.example.com/token')
    expect(config.fhirBaseUrl).toBe('https://ehr.example.com/fhir')
  })

  it('falls back to metadata', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rest: [
            {
              security: {
                extension: [
                  {
                    url: 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris',
                    extension: [
                      { url: 'authorize', valueUri: 'https://ehr.example.com/auth' },
                      { url: 'token', valueUri: 'https://ehr.example.com/token' },
                    ],
                  },
                ],
              },
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const config = await discoverSmartConfiguration('https://ehr.example.com')
    expect(config.authorizationEndpoint).toBe('https://ehr.example.com/auth')
    expect(config.tokenEndpoint).toBe('https://ehr.example.com/token')
  })
})
