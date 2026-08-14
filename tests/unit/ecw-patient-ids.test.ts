import { describe, expect, it } from 'vitest'
import { extractEcwSecondaryMrn } from '@/lib/integrations/ehr/ecwPatientIds'

describe('extractEcwSecondaryMrn', () => {
  const fhirId = 'W6s8TGka96L4tHbCRoQU8aCUj1sASobCtgwjt6SvNUY'

  it('returns the secondary identifier value', () => {
    expect(
      extractEcwSecondaryMrn({
        id: fhirId,
        identifier: [
          { use: 'usual', value: fhirId },
          { use: 'secondary', value: '9578' },
        ],
      })
    ).toBe('9578')
  })

  it('returns null when only the usual FHIR-id identifier is present', () => {
    expect(
      extractEcwSecondaryMrn({
        id: fhirId,
        identifier: [{ use: 'usual', system: 'urn:oid:2.16.840.1.113883.4.391.326205', value: fhirId }],
      })
    ).toBeNull()
  })

  it('returns null when identifiers are missing', () => {
    expect(extractEcwSecondaryMrn({ id: fhirId })).toBeNull()
    expect(extractEcwSecondaryMrn({ id: fhirId, identifier: [] })).toBeNull()
    expect(extractEcwSecondaryMrn(null)).toBeNull()
    expect(extractEcwSecondaryMrn(undefined)).toBeNull()
  })

  it('ignores a secondary value that is the same as Patient.id', () => {
    expect(
      extractEcwSecondaryMrn({
        id: fhirId,
        identifier: [{ use: 'secondary', value: fhirId }],
      })
    ).toBeNull()
  })
})
