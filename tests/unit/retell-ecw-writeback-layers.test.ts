import { describe, it, expect } from 'vitest'
import {
  getRetellEcwWritebackLayerFlags,
  encounterAndNotesAllowedForPatientMode,
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

  it('always allows encounter+notes for check_only and conflict', () => {
    const off = {
      ...base,
      ehrRetellWritebackEncounterAndNotesWhenNewPatient: false,
      ehrRetellWritebackEncounterAndNotesWhenExistingPatient: false,
    }
    expect(encounterAndNotesAllowedForPatientMode(off, 'check_only')).toBe(true)
    expect(encounterAndNotesAllowedForPatientMode(off, 'conflict')).toBe(true)
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
