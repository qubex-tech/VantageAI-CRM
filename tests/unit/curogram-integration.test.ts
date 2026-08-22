import { describe, expect, it } from 'vitest'
import {
  buildCurogramIntentTopicWithPatientContext,
  normalizeCurogramAiV2Gender,
  normalizePhoneToE164,
  resolveCurogramMappingId,
} from '@/lib/curogram'
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

  describe('buildCurogramIntentTopicWithPatientContext', () => {
    it('normalizes phone number line to +1 format for US numbers', () => {
      const topic = buildCurogramIntentTopicWithPatientContext({
        extracted: {
          call_summary: 'New patient appointment request',
          patient_name: 'Della Pest',
          patient_phone_number: '8569125689',
        },
      })

      expect(topic).toContain('Phone number: +18569125689')
    })
  })

  describe('normalizeCurogramAiV2Gender', () => {
    it('maps common values to API-allowed case-sensitive values', () => {
      expect(normalizeCurogramAiV2Gender('male')).toBe('Male')
      expect(normalizeCurogramAiV2Gender('Female')).toBe('Female')
      expect(normalizeCurogramAiV2Gender('non-binary')).toBe('Other')
      expect(normalizeCurogramAiV2Gender('unknown')).toBe('Prefer not to say')
    })

    it('omits unsupported values instead of sending invalid gender', () => {
      expect(normalizeCurogramAiV2Gender('Prefer no answer')).toBeUndefined()
    })
  })

  describe('resolveCurogramMappingId', () => {
    it('uses stored MRN when present', () => {
      expect(
        resolveCurogramMappingId({
          externalMrn: '9578',
          fetchedMrn: null,
        })
      ).toEqual({ mappingId: '9578', source: 'mrn' })
    })

    it('uses fetched MRN when stored MRN is missing', () => {
      expect(
        resolveCurogramMappingId({
          externalMrn: null,
          fetchedMrn: '14407',
        })
      ).toEqual({ mappingId: '14407', source: 'mrn_fetched' })
    })

    it('sends a blank mappingId when no account number exists', () => {
      expect(
        resolveCurogramMappingId({
          externalMrn: null,
          fetchedMrn: null,
        })
      ).toEqual({ mappingId: '', source: 'blank' })
    })
  })
})
