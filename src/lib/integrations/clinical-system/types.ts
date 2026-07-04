export const CLINICAL_SYSTEM_TYPES = ['none', 'fhir', 'open_dental'] as const

export type ClinicalSystemType = (typeof CLINICAL_SYSTEM_TYPES)[number]

/**
 * Legacy combined mode (read + write use the same source). Prefer {@link SchedulingSettings.readSource}
 * and {@link SchedulingSettings.writeSource} for new configuration.
 */
export const SCHEDULING_MODES = ['cal', 'open_dental'] as const

export type SchedulingMode = (typeof SCHEDULING_MODES)[number]

/**
 * Where availability is read from or appointments are written to.
 *  - 'cal'         -> Cal.com event types + slots
 *  - 'open_dental' -> Open Dental schedule
 *  - 'none'        -> disabled for that direction (e.g. read-only availability)
 */
export const SCHEDULING_SOURCES = ['none', 'cal', 'open_dental', 'ecw'] as const

export type SchedulingSource = (typeof SCHEDULING_SOURCES)[number]

export type SchedulingSettings = {
  /** @deprecated Use readSource — kept for backward compatibility when read === write */
  mode?: SchedulingMode
  /** Where open appointment slots are checked (voice agent, CRM UI, Healix). */
  readSource?: SchedulingSource
  /** Where new appointments are written when booking. */
  writeSource?: SchedulingSource
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
  /** eClinicalWorks practitioner reference for reading schedule (Practitioner/{id}). */
  defaultReadPractitionerRef?: string | null
  /** eClinicalWorks practitioner reference for booking writeback. */
  defaultWritePractitionerRef?: string | null
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

export const DEFAULT_SCHEDULING_SETTINGS: SchedulingSettings = {
  mode: 'cal',
  readSource: 'cal',
  writeSource: 'cal',
}

export function resolveReadSource(settings: SchedulingSettings): SchedulingSource {
  if (settings.readSource) return settings.readSource
  return settings.mode === 'open_dental' ? 'open_dental' : 'cal'
}

export function resolveWriteSource(settings: SchedulingSettings): SchedulingSource {
  if (settings.writeSource) return settings.writeSource
  return settings.mode === 'open_dental' ? 'open_dental' : 'cal'
}

export function usesOpenDentalForRead(settings: SchedulingSettings): boolean {
  return resolveReadSource(settings) === 'open_dental'
}

export function usesOpenDentalForWrite(settings: SchedulingSettings): boolean {
  return resolveWriteSource(settings) === 'open_dental'
}

export function usesCalForRead(settings: SchedulingSettings): boolean {
  return resolveReadSource(settings) === 'cal'
}

export function usesCalForWrite(settings: SchedulingSettings): boolean {
  return resolveWriteSource(settings) === 'cal'
}

export function usesEcwForRead(settings: SchedulingSettings): boolean {
  return resolveReadSource(settings) === 'ecw'
}

export function usesEcwForWrite(settings: SchedulingSettings): boolean {
  return resolveWriteSource(settings) === 'ecw'
}

export function resolveReadPractitionerRef(settings: SchedulingSettings): string | null {
  return settings.defaultReadPractitionerRef ?? settings.defaultWritePractitionerRef ?? null
}

export function resolveWritePractitionerRef(settings: SchedulingSettings): string | null {
  return settings.defaultWritePractitionerRef ?? settings.defaultReadPractitionerRef ?? null
}

export function canBookAppointments(settings: SchedulingSettings): boolean {
  return resolveWriteSource(settings) !== 'none'
}

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
