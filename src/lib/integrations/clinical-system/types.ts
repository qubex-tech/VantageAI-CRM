export const CLINICAL_SYSTEM_TYPES = ['none', 'fhir', 'open_dental'] as const

export type ClinicalSystemType = (typeof CLINICAL_SYSTEM_TYPES)[number]

/**
 * Where appointment scheduling/booking happens for a practice:
 *  - 'cal'         -> Cal.com event types + slots (the default)
 *  - 'open_dental' -> Open Dental schedule: pull open slots, book directly into OD
 */
export const SCHEDULING_MODES = ['cal', 'open_dental'] as const

export type SchedulingMode = (typeof SCHEDULING_MODES)[number]

export type SchedulingSettings = {
  mode: SchedulingMode
  /** Open Dental provider used by default when fetching slots / booking (EHR mode). */
  defaultProvNum?: number | null
  /** Open Dental operatory used by default when fetching slots / booking (EHR mode). */
  defaultOperatoryNum?: number | null
  /** Default visit length in minutes for EHR-native booking. */
  defaultLengthMinutes?: number | null
}

export const DEFAULT_SCHEDULING_SETTINGS: SchedulingSettings = { mode: 'cal' }

export type ClinicalIntegrationSettings = {
  system: ClinicalSystemType
  scheduling?: SchedulingSettings
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
