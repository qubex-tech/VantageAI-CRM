import { describe, expect, it } from 'vitest'
import { normalizePhoneToE164 } from '@/lib/curogram'
import { shouldTriggerCurogramEscalation } from '@/lib/process-call-data'

describe('curogram integration safeguards', () => {
  describe('shouldTriggerCurogramEscalation', () => {
    it('triggers when explicit new patient flag is true', () => {
      expect(
        shouldTriggerCurogramEscalation({
          extractedData: {
            new_patient_add: true,
            existing_patient_update: false,
          },
        })
      ).toBe(true)
    })

    it('does not trigger when existing patient update is true', () => {
      expect(
        shouldTriggerCurogramEscalation({
          extractedData: {
            new_patient_add: true,
            existing_patient_update: true,
          },
        })
      ).toBe(false)
    })

    it('triggers from patient_type fallback when new flag is missing', () => {
      expect(
        shouldTriggerCurogramEscalation({
          extractedData: {
            patient_type: 'new patient',
          },
        })
      ).toBe(true)
    })

    it('does not trigger for non-new patient_type when flags are missing', () => {
      expect(
        shouldTriggerCurogramEscalation({
          extractedData: {
            patient_type: 'existing patient',
          },
        })
      ).toBe(false)
    })

    it('reads Retell custom_data boolean variants', () => {
      expect(
        shouldTriggerCurogramEscalation({
          extractedData: {
            retell_custom_data: {
              'new patient add': 'yes',
              'existing patient update': 'no',
            },
          },
        })
      ).toBe(true)
    })

    it('prioritizes existing update exclusion over patient_type fallback', () => {
      expect(
        shouldTriggerCurogramEscalation({
          extractedData: {
            patient_type: 'new patient',
            retell_custom_data: {
              'Existing Patient Update': 'true',
            },
          },
        })
      ).toBe(false)
    })
  })

  describe('normalizePhoneToE164', () => {
    it('normalizes 10-digit US numbers with +1', () => {
      expect(normalizePhoneToE164('832-692-4438')).toBe('+18326924438')
    })

    it('normalizes 11-digit US numbers with leading country code', () => {
      expect(normalizePhoneToE164('18326924438')).toBe('+18326924438')
    })

    it('preserves international numbers and plus-prefixed formatting', () => {
      expect(normalizePhoneToE164('+44 7911 123456')).toBe('+447911123456')
    })
  })
})
