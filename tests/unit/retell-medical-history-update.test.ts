import { describe, expect, it } from 'vitest'
import { extractCallData } from '@/lib/process-call-data'
import {
  extractMedicalHistoryUpdate,
  formatMedicalHistoryUpdateCommlogLines,
  hasMedicalHistoryUpdateInMetadata,
} from '@/lib/retell-medical-history-update'
import type { RetellCall } from '@/lib/retell-api'

const SAMPLE_FIELDS = {
  'Updated Medications': 'Started lisinopril 10mg daily; discontinued ibuprofen',
  'Updated Medical History': 'Recently diagnosed with hypertension',
  'Updated Allergies': 'Penicillin — rash',
}

describe('extractMedicalHistoryUpdate', () => {
  it('reads Retell display-name keys', () => {
    expect(extractMedicalHistoryUpdate([SAMPLE_FIELDS])).toEqual({
      medications: 'Started lisinopril 10mg daily; discontinued ibuprofen',
      medicalHistory: 'Recently diagnosed with hypertension',
      allergies: 'Penicillin — rash',
    })
  })

  it('keeps only fields that were discussed', () => {
    expect(
      extractMedicalHistoryUpdate([
        {
          'Updated Medications': '  ',
          updated_allergies: 'Latex',
          'Call Reason': 'medical history',
        },
      ])
    ).toEqual({
      allergies: 'Latex',
    })
  })

  it('returns undefined when none of the medical-history fields were discussed', () => {
    expect(extractMedicalHistoryUpdate([undefined, { 'Call Reason': 'hours' }])).toBeUndefined()
    expect(
      extractMedicalHistoryUpdate([
        {
          'Updated Medications': '',
          'Updated Medical History': '   ',
          'Updated Allergies': '',
        },
      ])
    ).toBeUndefined()
  })

  it('formats commlog lines with original Retell labels', () => {
    const data = extractMedicalHistoryUpdate([SAMPLE_FIELDS])
    expect(formatMedicalHistoryUpdateCommlogLines(data!)).toEqual([
      'Updated Medications: Started lisinopril 10mg daily; discontinued ibuprofen',
      'Updated Medical History: Recently diagnosed with hypertension',
      'Updated Allergies: Penicillin — rash',
    ])
  })
})

describe('hasMedicalHistoryUpdateInMetadata', () => {
  it('detects fields on retell_custom_data or structured medical_history_update', () => {
    expect(hasMedicalHistoryUpdateInMetadata({ retell_custom_data: SAMPLE_FIELDS })).toBe(true)
    expect(
      hasMedicalHistoryUpdateInMetadata({
        medical_history_update: { allergies: 'Latex' },
      })
    ).toBe(true)
    expect(hasMedicalHistoryUpdateInMetadata({ call_summary: 'Asked about hours' })).toBe(false)
    expect(hasMedicalHistoryUpdateInMetadata(null)).toBe(false)
  })
})

describe('extractCallData medical history update', () => {
  it('maps custom_analysis_data medical history fields onto ExtractedCallData', () => {
    const extracted = extractCallData({
      call_id: 'call_1',
      call_analysis: { custom_analysis_data: SAMPLE_FIELDS },
    } as RetellCall)

    expect(extracted.medical_history_update).toEqual({
      medications: 'Started lisinopril 10mg daily; discontinued ibuprofen',
      medicalHistory: 'Recently diagnosed with hypertension',
      allergies: 'Penicillin — rash',
    })
  })

  it('does not attach medical_history_update on ordinary calls', () => {
    const extracted = extractCallData({
      call_id: 'call_2',
      call_analysis: {
        custom_analysis_data: {
          'Patient First Name': 'Jane',
          'Call Reason': 'Schedule cleaning',
        },
      },
    } as RetellCall)

    expect(extracted.medical_history_update).toBeUndefined()
  })
})
