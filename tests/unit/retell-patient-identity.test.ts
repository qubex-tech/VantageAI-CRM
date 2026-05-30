import { describe, it, expect } from 'vitest'
import {
  hasExplicitRetellPatientIdentity,
  looksLikePhoneNumber,
  resolveExplicitPatientNameForEhrLookup,
  resolvePatientStatedPhoneForEhrLookup,
} from '@/lib/retell-patient-identity'

describe('retell-patient-identity', () => {
  it('treats shared inbound numbers as not patient names', () => {
    expect(looksLikePhoneNumber('+17135881674')).toBe(true)
    expect(hasExplicitRetellPatientIdentity({ patient_name: '+17135881674' })).toBe(false)
  })

  it('accepts first/last name from Retell custom analysis', () => {
    const extracted = {
      patient_name: '',
      retell_custom_data: {
        'Patient First Name': 'Hansa',
        'Patient Last Name': 'Patel',
      },
    }
    expect(hasExplicitRetellPatientIdentity(extracted)).toBe(true)
    expect(resolveExplicitPatientNameForEhrLookup(extracted)).toBe('Hansa Patel')
  })

  it('does not use ANI for eCW lookup phone', () => {
    expect(
      resolvePatientStatedPhoneForEhrLookup({
        user_phone_number: '+17135881674',
        patient_phone_number: '',
      } as any)
    ).toBeNull()
  })

  it('uses patient-stated phone when present', () => {
    expect(
      resolvePatientStatedPhoneForEhrLookup({
        patient_phone_number: '(979) 328-4937',
      } as any)
    ).toBe('(979) 328-4937')
  })
})
