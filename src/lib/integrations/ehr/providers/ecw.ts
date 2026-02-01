import { z } from 'zod'
import { EhrProvider } from '../types'

const configSchema = z.object({
  issuer: z.string().url(),
  fhirBaseUrl: z.string().url().optional(),
  clientId: z.string().min(3),
  clientSecret: z.string().min(4).optional(),
})

export const ecwProvider: EhrProvider = {
  id: 'ecw',
  displayName: 'eClinicalWorks',
  description: 'SMART on FHIR for eClinicalWorks',
  configSchema,
  uiFields: [
    { id: 'issuer', label: 'Issuer URL', type: 'url', required: true },
    { id: 'fhirBaseUrl', label: 'FHIR Base URL (optional override)', type: 'url' },
    { id: 'clientId', label: 'Client ID', type: 'text', required: true },
    { id: 'clientSecret', label: 'Client Secret (optional)', type: 'password' },
  ],
  allowConfidentialClient: true,
  buildFhirBaseUrl: (config) => {
    const issuer = String(config.issuer || '').replace(/\/+$/g, '')
    const override = config.fhirBaseUrl ? String(config.fhirBaseUrl) : ''
    return (override || issuer).replace(/\/+$/g, '')
  },
  defaultScopes: ({ enableWrite, enablePatientCreate, enableNoteCreate }) => {
    const scopes = new Set(
      'openid fhirUser profile offline_access patient/Patient.read patient/DocumentReference.read'
        .split(' ')
        .filter(Boolean)
    )
    if (enableWrite) {
      if (enablePatientCreate) scopes.add('patient/Patient.write')
      if (enableNoteCreate) scopes.add('patient/DocumentReference.write')
    }
    return Array.from(scopes).join(' ')
  },
}
