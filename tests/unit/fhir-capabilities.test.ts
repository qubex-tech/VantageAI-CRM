import { describe, it, expect } from 'vitest'
import {
  extractSmartOAuthUris,
  supportsResourceInteraction,
} from '@/lib/integrations/fhir/capabilities'

describe('FHIR capabilities parsing', () => {
  it('extracts SMART OAuth URIs from capability statement', () => {
    const capability = {
      rest: [
        {
          security: {
            extension: [
              {
                url: 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris',
                extension: [
                  { url: 'authorize', valueUri: 'https://ehr.example.com/auth' },
                  { url: 'token', valueUri: 'https://ehr.example.com/token' },
                  { url: 'revoke', valueUri: 'https://ehr.example.com/revoke' },
                ],
              },
            ],
          },
        },
      ],
    }

    const uris = extractSmartOAuthUris(capability as any)
    expect(uris?.authorizationEndpoint).toBe('https://ehr.example.com/auth')
    expect(uris?.tokenEndpoint).toBe('https://ehr.example.com/token')
    expect(uris?.revocationEndpoint).toBe('https://ehr.example.com/revoke')
  })

  it('detects resource interactions', () => {
    const capability = {
      rest: [
        {
          resource: [
            {
              type: 'Patient',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
            },
            {
              type: 'DocumentReference',
              interaction: [{ code: 'create' }],
            },
          ],
        },
      ],
    }

    expect(supportsResourceInteraction(capability as any, 'Patient', 'read')).toBe(true)
    expect(supportsResourceInteraction(capability as any, 'Patient', 'create')).toBe(false)
    expect(supportsResourceInteraction(capability as any, 'DocumentReference', 'create')).toBe(true)
  })
})
