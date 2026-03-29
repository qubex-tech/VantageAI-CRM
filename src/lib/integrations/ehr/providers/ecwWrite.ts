import { z } from 'zod'
import { EhrProvider } from '../types'

const configSchema = z.object({
  issuer: z.string().url(),
  fhirBaseUrl: z.string().url().optional(),
  clientId: z.string().min(3),
  clientSecret: z.string().min(4).optional(),
  ecwTelephoneParticipantPractitionerRef: z.string().optional(),
  ecwTelephoneAssignedToPractitionerRef: z.string().optional(),
  ecwTelephoneLocationRef: z.string().optional(),
  ecwTelephoneOrganizationRef: z.string().optional(),
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
    {
      id: 'ecwTelephoneParticipantPractitionerRef',
      label: 'Telephone Encounter Practitioner Ref',
      type: 'text',
      helpText: 'FHIR Practitioner reference (for example Practitioner/<id> or raw <id>).',
    },
    {
      id: 'ecwTelephoneAssignedToPractitionerRef',
      label: 'Telephone Encounter Assigned-To Ref',
      type: 'text',
      helpText: 'FHIR Practitioner reference for telephoneEncounter/assignedTo.',
    },
    {
      id: 'ecwTelephoneLocationRef',
      label: 'Telephone Encounter Location Ref',
      type: 'text',
      helpText: 'FHIR Location reference (for example Location/<id> or raw <id>).',
    },
    {
      id: 'ecwTelephoneOrganizationRef',
      label: 'Telephone Encounter Organization Ref',
      type: 'text',
      helpText: 'FHIR Organization reference for Encounter.serviceProvider.',
    },
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
      scopes.add('system/Encounter.write')
      if (enablePatientCreate) scopes.add('system/Patient.write')
      if (enableNoteCreate) scopes.add('system/DocumentReference.write')
    }
    return Array.from(scopes).join(' ')
  },
}
