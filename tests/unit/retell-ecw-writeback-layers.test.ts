import { describe, it, expect } from 'vitest'
import {
  getRetellEcwWritebackLayerFlags,
  encounterAndNotesAllowedForPatientMode,
  classifyEncounterNotesPatientPath,
} from '@/lib/integrations/ehr/writeback'

describe('getRetellEcwWritebackLayerFlags', () => {
  it('defaults all layers to true when settings are null', () => {
    expect(getRetellEcwWritebackLayerFlags(null)).toEqual({
      allowPatientCreate: true,
      allowEncounter: true,
      allowDraftNotes: true,
    })
  })

  it('defaults all layers to true when fields are undefined', () => {
    expect(getRetellEcwWritebackLayerFlags({ enabledProviders: [], providerConfigs: {} } as any)).toEqual({
      allowPatientCreate: true,
      allowEncounter: true,
      allowDraftNotes: true,
    })
  })

  it('respects explicit false for each layer', () => {
    expect(
      getRetellEcwWritebackLayerFlags({
        enabledProviders: [],
        providerConfigs: {},
        ehrRetellWritebackAllowPatientCreate: false,
        ehrRetellWritebackAllowTelephoneEncounter: false,
        ehrRetellWritebackAllowDraftNotes: false,
      } as any)
    ).toEqual({
      allowPatientCreate: false,
      allowEncounter: false,
      allowDraftNotes: false,
    })
  })
})

describe('encounterAndNotesAllowedForPatientMode', () => {
  const base = { enabledProviders: [], providerConfigs: {} } as any

  it('defaults new and existing paths to true when settings are null', () => {
    expect(encounterAndNotesAllowedForPatientMode(null, 'new')).toBe(true)
    expect(encounterAndNotesAllowedForPatientMode(null, 'existing')).toBe(true)
  })

  it('defaults new and existing paths to true when fields are undefined', () => {
    expect(encounterAndNotesAllowedForPatientMode(base, 'new')).toBe(true)
    expect(encounterAndNotesAllowedForPatientMode(base, 'existing')).toBe(true)
  })

  it('allows encounter+notes for check_only when patient path is neutral (no new/existing hints)', () => {
    const off = {
      ...base,
      ehrRetellWritebackEncounterAndNotesWhenNewPatient: false,
      ehrRetellWritebackEncounterAndNotesWhenExistingPatient: false,
    }
    expect(encounterAndNotesAllowedForPatientMode(off, 'check_only', {})).toBe(true)
    expect(encounterAndNotesAllowedForPatientMode(off, 'conflict')).toBe(true)
  })

  it('applies new-patient toggle for check_only when patient_type indicates new', () => {
    const off = { ...base, ehrRetellWritebackEncounterAndNotesWhenNewPatient: false }
    const extracted = { patient_type: 'New Patient' } as any
    expect(encounterAndNotesAllowedForPatientMode(off, 'check_only', extracted)).toBe(false)
  })

  it('applies existing-patient toggle for check_only when patient_type indicates existing', () => {
    const off = { ...base, ehrRetellWritebackEncounterAndNotesWhenExistingPatient: false }
    const extracted = { patient_type: 'Existing Patient' } as any
    expect(encounterAndNotesAllowedForPatientMode(off, 'check_only', extracted)).toBe(false)
  })

  it('respects false for new vs existing only', () => {
    expect(
      encounterAndNotesAllowedForPatientMode(
        { ...base, ehrRetellWritebackEncounterAndNotesWhenNewPatient: false },
        'new'
      )
    ).toBe(false)
    expect(
      encounterAndNotesAllowedForPatientMode(
        { ...base, ehrRetellWritebackEncounterAndNotesWhenExistingPatient: false },
        'existing'
      )
    ).toBe(false)
  })
})

describe('classifyEncounterNotesPatientPath', () => {
  it('classifies check_only from patient_type', () => {
    expect(classifyEncounterNotesPatientPath('check_only', { patient_type: 'New Patient' } as any)).toBe(
      'new'
    )
    expect(
      classifyEncounterNotesPatientPath('check_only', { patient_type: 'Existing Patient' } as any)
    ).toBe('existing')
  })

  it('does not infer new from patient_type when new_patient_add is explicitly false', () => {
    expect(
      classifyEncounterNotesPatientPath('check_only', {
        new_patient_add: false,
        patient_type: 'New Patient',
      } as any)
    ).toBe('neutral')
  })
})
