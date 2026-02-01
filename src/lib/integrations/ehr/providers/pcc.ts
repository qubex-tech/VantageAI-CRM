import { z } from 'zod'
import { EhrProvider } from '../types'

const configSchema = z.object({
  issuer: z.string().url(),
  fhirBaseUrl: z.string().url().optional(),
  clientId: z.string().min(3),
  clientSecret: z.string().min(4).optional(),
  pccTenantId: z.string().min(1),
})

export const pccProvider: EhrProvider = {
  id: 'pcc',
  displayName: 'PointClickCare',
  description: 'SMART on FHIR for PointClickCare',
  configSchema,
  uiFields: [
    { id: 'issuer', label: 'Issuer URL', type: 'url', required: true },
    { id: 'fhirBaseUrl', label: 'FHIR Base URL (optional override)', type: 'url' },
    { id: 'clientId', label: 'Client ID', type: 'text', required: true },
    { id: 'clientSecret', label: 'Client Secret (optional)', type: 'password' },
    { id: 'pccTenantId', label: 'PCC Tenant ID', type: 'text', required: true },
  ],
  allowConfidentialClient: true,
  buildFhirBaseUrl: (config) => {
    const issuer = String(config.issuer || '').replace(/\/+$/g, '')
    const override = config.fhirBaseUrl ? String(config.fhirBaseUrl) : ''
    const baseUrl = (override || issuer).replace(/\/+$/g, '')
    const tenantId = String(config.pccTenantId || '').trim()
    return `${baseUrl}/fhir/R4/${tenantId}`
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
