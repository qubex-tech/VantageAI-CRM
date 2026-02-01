import { z } from 'zod'

export type EhrProviderId = 'ecw' | 'pcc' | 'athena' | 'epic' | 'generic'

export type EhrProviderField = {
  id: string
  label: string
  type: 'text' | 'password' | 'url'
  placeholder?: string
  helpText?: string
  required?: boolean
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
  enableWrite?: boolean
  enablePatientCreate?: boolean
  enableNoteCreate?: boolean
  enableBulkExport?: boolean
}
