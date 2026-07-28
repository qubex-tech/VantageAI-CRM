import { describe, expect, it } from 'vitest'
import {
  buildVoiceConversationEndedEventData,
  classifyRetellPatientTypeCategory,
  type ExtractedCallData,
} from '@/lib/process-call-data'
import type { RetellCall } from '@/lib/retell-api'

function callWithCustomAnalysis(data: Record<string, unknown>): RetellCall {
  return {
    call_id: 'call_test_1',
    call_type: 'phone_call',
    agent_id: 'agent_1',
    call_status: 'ended',
    call_analysis: {
      custom_analysis_data: data,
    },
  } as RetellCall
}

describe('classifyRetellPatientTypeCategory', () => {
  it('returns existing when existing_patient_update is true', () => {
    expect(
      classifyRetellPatientTypeCategory({
        existing_patient_update: true,
        new_patient_add: true,
        patient_type: 'new patient',
      })
    ).toBe('existing')
  })

  it('returns new when new_patient_add is true', () => {
    expect(
      classifyRetellPatientTypeCategory({
        new_patient_add: true,
      })
    ).toBe('new')
  })

  it('reads Retell custom_data boolean variants', () => {
    expect(
      classifyRetellPatientTypeCategory({
        retell_custom_data: {
          'Existing Patient Update': 'yes',
        },
      })
    ).toBe('existing')
    expect(
      classifyRetellPatientTypeCategory({
        retell_custom_data: {
          'new patient add': 'true',
        },
      })
    ).toBe('new')
  })

  it('classifies from patient_type string heuristics', () => {
    expect(classifyRetellPatientTypeCategory({ patient_type: 'existing patient' })).toBe(
      'existing'
    )
    expect(classifyRetellPatientTypeCategory({ patient_type: 'Established' })).toBe('existing')
    expect(classifyRetellPatientTypeCategory({ patient_type: 'returning patient' })).toBe(
      'existing'
    )
    expect(classifyRetellPatientTypeCategory({ patient_type: 'New Patient' })).toBe('new')
  })

  it('returns unknown when signals are missing or ambiguous', () => {
    expect(classifyRetellPatientTypeCategory({})).toBe('unknown')
    expect(classifyRetellPatientTypeCategory({ patient_type: 'walk-in' })).toBe('unknown')
  })
})

describe('buildVoiceConversationEndedEventData', () => {
  it('includes transferFailed and patientTypeCategory for automation conditions', () => {
    const extractedData: ExtractedCallData = {
      patient_type: 'new patient',
      new_patient_add: true,
      existing_patient_update: false,
    }
    const data = buildVoiceConversationEndedEventData({
      call: callWithCustomAnalysis({
        'Transfer Outcome': 'not successful',
        'Patient Type': 'new patient',
      }),
      extractedData,
      conversation: {
        id: 'conv_1',
        patientId: 'pat_1',
        outcome: 'information_only',
        retellCallId: 'call_test_1',
      },
      patient: {
        id: 'pat_1',
        name: 'Jane Doe',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+15551234567',
        primaryPhone: '+15551234567',
        dateOfBirth: new Date('1990-01-15T00:00:00.000Z'),
      },
    })

    expect(data.patientId).toBe('pat_1')
    expect(data.patient).toMatchObject({
      id: 'pat_1',
      firstName: 'Jane',
      lastName: 'Doe',
    })
    expect(data.conversation).toMatchObject({
      id: 'conv_1',
      patientId: 'pat_1',
      retellCallId: 'call_test_1',
    })
    expect(data.call).toEqual({
      transferFailed: true,
      transferOutcome: 'not successful',
      patientType: 'new patient',
      newPatientAdd: true,
      existingPatientUpdate: false,
      patientTypeCategory: 'new',
    })
  })

  it('marks transferFailed false and patientTypeCategory existing for successful existing-patient calls', () => {
    const data = buildVoiceConversationEndedEventData({
      call: callWithCustomAnalysis({
        transfer_outcome: 'successful',
      }),
      extractedData: {
        existing_patient_update: true,
        patient_type: 'existing patient',
      },
      conversation: {
        id: 'conv_2',
        patientId: null,
        outcome: null,
        retellCallId: 'call_test_1',
      },
      patient: null,
    })

    expect(data.patientId).toBeNull()
    expect(data.patient).toBeUndefined()
    expect(data.call).toMatchObject({
      transferFailed: false,
      patientTypeCategory: 'existing',
    })
  })
})
