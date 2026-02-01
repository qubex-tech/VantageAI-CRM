import { describe, it, expect } from 'vitest'
import { pccProvider } from '@/lib/integrations/ehr/providers/pcc'

describe('EHR providers', () => {
  it('builds PCC base URL with tenant id', () => {
    const url = pccProvider.buildFhirBaseUrl({
      issuer: 'https://pcc.example.com',
      pccTenantId: 'tenant-123',
    })
    expect(url).toBe('https://pcc.example.com/fhir/R4/tenant-123')
  })
})
