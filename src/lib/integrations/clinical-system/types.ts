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
  /** Open Dental provider used when reading available slots (EHR mode). Falls back to defaultProvNum. */
  defaultReadProvNum?: number | null
  /** Primary operatory when reading available slots. Falls back to defaultOperatoryNum. */
  defaultReadOperatoryNum?: number | null
  /** Extra operatories to include when reading slots (in addition to the primary read operatory). */
  defaultReadOperatoryNums?: number[] | null
  /** Default visit length in minutes when reading available slots. Falls back to defaultLengthMinutes. */
  defaultReadLengthMinutes?: number | null
  /** Open Dental provider used when booking appointments (EHR mode). */
  defaultProvNum?: number | null
  /** Primary operatory when booking appointments into Open Dental. */
  defaultOperatoryNum?: number | null
  /** Extra operatories eligible for booking (in addition to the primary booking operatory). */
  defaultOperatoryNums?: number[] | null
  /** Default visit length in minutes for EHR-native booking. */
  defaultLengthMinutes?: number | null
}

function dedupePositiveInts(values: Array<number | null | undefined>): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const value of values) {
    if (!Number.isInteger(value) || !value || value <= 0 || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

/** Provider for slot availability queries — read default, then booking default. */
export function resolveReadProvNum(settings: SchedulingSettings): number | null {
  return settings.defaultReadProvNum ?? settings.defaultProvNum ?? null
}

/** All operatories used when reading available slots. */
export function resolveReadOperatoryNums(settings: SchedulingSettings): number[] {
  const additional = settings.defaultReadOperatoryNums ?? []
  const primary = settings.defaultReadOperatoryNum
  if (primary && primary > 0) {
    return dedupePositiveInts([primary, ...additional])
  }
  if (additional.length > 0) {
    return dedupePositiveInts(additional)
  }
  return resolveBookOperatoryNums(settings)
}

/** Primary operatory for slot reads — first entry from {@link resolveReadOperatoryNums}. */
export function resolveReadOperatoryNum(settings: SchedulingSettings): number | null {
  return resolveReadOperatoryNums(settings)[0] ?? null
}

/** All operatories eligible when booking into Open Dental. */
export function resolveBookOperatoryNums(settings: SchedulingSettings): number[] {
  const additional = settings.defaultOperatoryNums ?? []
  const primary = settings.defaultOperatoryNum
  if (primary && primary > 0) {
    return dedupePositiveInts([primary, ...additional])
  }
  return dedupePositiveInts(additional)
}

/** Primary operatory for booking — first entry from {@link resolveBookOperatoryNums}. */
export function resolveBookOperatoryNum(settings: SchedulingSettings): number | null {
  return resolveBookOperatoryNums(settings)[0] ?? null
}

/** Visit length for slot availability queries — read default, then booking default. */
export function resolveReadLengthMinutes(settings: SchedulingSettings): number | null {
  return settings.defaultReadLengthMinutes ?? settings.defaultLengthMinutes ?? null
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
