import { z } from 'zod'

export type EhrProviderId = 'ecw' | 'ecw_bulk' | 'ecw_write' | 'pcc' | 'athena' | 'epic' | 'generic'

export type EhrProviderField = {
  id: string
  label: string
  type: 'text' | 'password' | 'url' | 'select' | 'boolean'
  placeholder?: string
  helpText?: string
  required?: boolean
  options?: Array<{ label: string; value: string }>
}

export type EhrProviderConfig = Record<string, unknown>

export type EhrProvider = {
  id: EhrProviderId
  displayName: string
  description?: string
  configSchema: z.ZodSchema<EhrProviderConfig>
  uiFields: EhrProviderField[]
  supportsBulkExport?: boolean
  allowConfidentialClient?: boolean
  buildFhirBaseUrl: (config: EhrProviderConfig) => string
  defaultScopes: (params: {
    enableWrite?: boolean
    enablePatientCreate?: boolean
    enableNoteCreate?: boolean
    enableBulkExport?: boolean
  }) => string
  transformLaunchParams?: (params: Record<string, string>) => Record<string, string>
  postConnectHook?: (params: { connectionId: string; config: EhrProviderConfig }) => Promise<void>
  normalizeErrors?: (error: unknown) => { code: string; message: string }
}

export type EhrConnectionStatus = 'connected' | 'expired' | 'disconnected' | 'error'

export type EhrSettings = {
  enabledProviders: EhrProviderId[]
  providerConfigs: Record<string, EhrProviderConfig>
  ehrTimeZone?: string
  enableWrite?: boolean
  enablePatientCreate?: boolean
  enableNoteCreate?: boolean
  enableBulkExport?: boolean
  /** Retell post-call: allow FHIR Patient create in eCW when agent path is “new” (default true). */
  ehrRetellWritebackAllowPatientCreate?: boolean
  /** Retell post-call: allow telephone Encounter transaction POST (default true). */
  ehrRetellWritebackAllowTelephoneEncounter?: boolean
  /** Retell post-call: allow draft DocumentReference notes (call summary + telephone draft) (default true). */
  ehrRetellWritebackAllowDraftNotes?: boolean
  /** Retell post-call: when false, skip all eCW writes if Retell resolves to `new` (default true). */
  ehrWritebackOnNewPatientAdd?: boolean
  /** Retell post-call: when false, skip all eCW writes if Retell resolves to `existing` (default true). */
  ehrWritebackOnExistingPatientUpdate?: boolean
  /**
   * Retell post-call: when false, skip telephone encounter and draft notes when Retell resolves to `new`
   * (still subject to global encounter/notes toggles). Default true.
   */
  ehrRetellWritebackEncounterAndNotesWhenNewPatient?: boolean
  /**
   * Retell post-call: when false, skip telephone encounter and draft notes when Retell resolves to `existing`
   * (still subject to global encounter/notes toggles). Default true.
   */
  ehrRetellWritebackEncounterAndNotesWhenExistingPatient?: boolean
}
