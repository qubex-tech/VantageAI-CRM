import { describe, it, expect } from 'vitest'
import { getRetellEcwWritebackLayerFlags } from '@/lib/integrations/ehr/writeback'

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
