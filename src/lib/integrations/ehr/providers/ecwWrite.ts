import { z } from 'zod'
import { EhrProvider } from '../types'

const configSchema = z.object({
  issuer: z.string().url(),
  fhirBaseUrl: z.string().url().optional(),
  clientId: z.string().min(3),
  clientSecret: z.string().min(4).optional(),
  authFlow: z.literal('backend_services').optional().default('backend_services'),
})

export const ecwWriteProvider: EhrProvider = {
  id: 'ecw_write',
  displayName: 'eClinicalWorks - Backend (Write)',
  description: 'Backend services app for draft note and patient write-back.',
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
    const scopes = new Set(['system/Patient.read', 'system/DocumentReference.read'])
    if (enableWrite) {
      if (enablePatientCreate) scopes.add('system/Patient.write')
      if (enableNoteCreate) scopes.add('system/DocumentReference.write')
    }
    return Array.from(scopes).join(' ')
  },
}
