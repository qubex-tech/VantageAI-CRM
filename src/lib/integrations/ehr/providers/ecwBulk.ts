import { z } from 'zod'
import { EhrProvider } from '../types'

const configSchema = z.object({
  issuer: z.string().url(),
  fhirBaseUrl: z.string().url().optional(),
  clientId: z.string().min(3),
  clientSecret: z.string().min(4).optional(),
  authFlow: z.literal('backend_services').optional().default('backend_services'),
  orgId: z.string().min(1),
  groupId: z.string().min(1),
})

export const ecwBulkProvider: EhrProvider = {
  id: 'ecw_bulk',
  displayName: 'eClinicalWorks - Backend (Bulk Read)',
  description: 'Backend services app for nightly patient sync (read-only).',
  configSchema,
  uiFields: [
    { id: 'issuer', label: 'Issuer URL', type: 'url', required: true },
    { id: 'fhirBaseUrl', label: 'FHIR Base URL (optional override)', type: 'url' },
    { id: 'clientId', label: 'Client ID', type: 'text', required: true },
    { id: 'clientSecret', label: 'Client Secret (optional)', type: 'password' },
    {
      id: 'orgId',
      label: 'eCW Org ID',
      type: 'text',
      required: true,
      helpText: 'Required for bulk export URLs (org_id path segment).',
    },
    {
      id: 'groupId',
      label: 'Group ID',
      type: 'text',
      required: true,
      helpText: 'FHIR Group ID used for bulk $export kickoff.',
    },
  ],
  allowConfidentialClient: true,
  supportsBulkExport: true,
  buildFhirBaseUrl: (config) => {
    const issuer = String(config.issuer || '').replace(/\/+$/g, '')
    const override = config.fhirBaseUrl ? String(config.fhirBaseUrl) : ''
    return (override || issuer).replace(/\/+$/g, '')
  },
  defaultScopes: () => {
    return 'system/Patient.read system/Group.read'
  },
}
