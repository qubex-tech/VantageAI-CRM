import { describe, it, expect } from 'vitest'
import { sanitizeEcwFhirRequestPath } from '@/lib/integrations/ehr/scheduleSync'

describe('sanitizeEcwFhirRequestPath', () => {
  it('removes _count from relative FHIR search paths', () => {
    expect(sanitizeEcwFhirRequestPath('/Practitioner?_count=200')).toBe('/Practitioner')
    expect(sanitizeEcwFhirRequestPath('/Practitioner?_id=abc&_count=1')).toBe(
      '/Practitioner?_id=abc'
    )
  })

  it('removes _count from absolute pagination next links', () => {
    expect(
      sanitizeEcwFhirRequestPath(
        'https://fhir.example.com/Encounter?practitioner=Practitioner%2F1&date=ge2026-07-03&_count=50'
      )
    ).toBe('https://fhir.example.com/Encounter?practitioner=Practitioner%2F1&date=ge2026-07-03')
  })
})
