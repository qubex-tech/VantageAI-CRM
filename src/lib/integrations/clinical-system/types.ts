export const CLINICAL_SYSTEM_TYPES = ['none', 'fhir', 'open_dental'] as const

export type ClinicalSystemType = (typeof CLINICAL_SYSTEM_TYPES)[number]

export type ClinicalIntegrationSettings = {
  system: ClinicalSystemType
}

export const CLINICAL_SYSTEM_OPTIONS: Array<{
  id: ClinicalSystemType
  label: string
  description: string
}> = [
  {
    id: 'none',
    label: 'None',
    description: 'No clinical system integration for this practice.',
  },
  {
    id: 'fhir',
    label: 'FHIR / SMART on FHIR',
    description: 'eClinicalWorks, PointClickCare, Athena, Epic, and other SMART providers.',
  },
  {
    id: 'open_dental',
    label: 'Open Dental',
    description: 'Open Dental REST API (separate from the FHIR integration stack).',
  },
]
