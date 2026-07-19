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

/** Canonical EHR visit type plus natural-language aliases the voice agent may send. */
export type VisitTypeMapping = {
  visitType: string
  aliases: string[]
}

/** Provider + operatories + length used when reading Open Dental availability. */
export type OdReadSlotConfig = {
  provNum: number
  operatoryNums: number[]
  lengthMinutes: number
}

/** Provider + write operatories + length + visit types used when booking into Open Dental. */
export type OdBookSlotConfig = {
  provNum: number
  operatoryNums: number[]
  lengthMinutes: number
  visitTypes: VisitTypeMapping[]
}

export type SchedulingSettings = {
  /** @deprecated Use readSource — kept for backward compatibility when read === write */
  mode?: SchedulingMode
  /** Where open appointment slots are checked (voice agent, CRM UI, Healix). */
  readSource?: SchedulingSource
  /** Where new appointments are written when booking. */
  writeSource?: SchedulingSource
  /** Multi-provider Open Dental read configs (preferred over legacy single defaults). */
  odReadSlotConfigs?: OdReadSlotConfig[] | null
  /** Multi-provider Open Dental booking configs with visit-type + NL aliases. */
  odBookSlotConfigs?: OdBookSlotConfig[] | null
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
  /** Additional eCW practitioners to include when reading schedule (empty = all practitioners). */
  defaultReadPractitionerRefs?: string[] | null
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
  const fromLegacy = dedupePositiveInts(additional)
  if (fromLegacy.length > 0) return fromLegacy

  // Prefer default (no visit-type) book rows; otherwise any configured book ops.
  const configs = resolveOdBookConfigs(settings)
  const defaults = configs.filter((c) => c.visitTypes.length === 0)
  const source = defaults.length > 0 ? defaults : configs
  return dedupePositiveInts(source.flatMap((c) => c.operatoryNums))
}

/** Primary operatory for booking — first entry from {@link resolveBookOperatoryNums}. */
export function resolveBookOperatoryNum(settings: SchedulingSettings): number | null {
  return resolveBookOperatoryNums(settings)[0] ?? null
}

/**
 * Booking row used when the agent does not supply a mapped visit type:
 * first `odBookSlotConfigs` row with empty visitTypes, else legacy-derived default.
 */
export function resolveDefaultOdBookConfig(
  settings: SchedulingSettings
): OdBookSlotConfig | null {
  const configs = resolveOdBookConfigs(settings)
  return configs.find((c) => c.visitTypes.length === 0) ?? null
}

/** True when at least one booking row has visit-type routing configured. */
export function hasTypedOdBookConfigs(settings: SchedulingSettings): boolean {
  return resolveOdBookConfigs(settings).some((c) => c.visitTypes.length > 0)
}

/** Visit length for slot availability queries — read default, then booking default. */
export function resolveReadLengthMinutes(settings: SchedulingSettings): number | null {
  return settings.defaultReadLengthMinutes ?? settings.defaultLengthMinutes ?? null
}

function normalizeVisitTypeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenizeVisitTypeKey(value: string): string[] {
  return normalizeVisitTypeKey(value)
    .split(' ')
    .filter((token) => token.length > 1)
}

function coerceVisitTypeMapping(raw: unknown): VisitTypeMapping | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as { visitType?: unknown; aliases?: unknown }
  const visitType = typeof obj.visitType === 'string' ? obj.visitType.trim() : ''
  if (!visitType) return null
  const aliases = Array.isArray(obj.aliases)
    ? obj.aliases
        .filter((a): a is string => typeof a === 'string')
        .map((a) => a.trim())
        .filter(Boolean)
    : []
  return { visitType, aliases }
}

function coerceOdReadSlotConfig(raw: unknown): OdReadSlotConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as {
    provNum?: unknown
    operatoryNums?: unknown
    lengthMinutes?: unknown
  }
  const provNum = Number(obj.provNum)
  const lengthMinutes = Number(obj.lengthMinutes)
  if (!Number.isInteger(provNum) || provNum <= 0) return null
  if (!Number.isInteger(lengthMinutes) || lengthMinutes <= 0) return null
  const operatoryNums = dedupePositiveInts(
    Array.isArray(obj.operatoryNums) ? obj.operatoryNums.map((n) => Number(n)) : []
  )
  if (operatoryNums.length === 0) return null
  return { provNum, operatoryNums, lengthMinutes }
}

function coerceOdBookSlotConfig(raw: unknown): OdBookSlotConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as {
    provNum?: unknown
    operatoryNums?: unknown
    lengthMinutes?: unknown
    visitTypes?: unknown
  }
  const provNum = Number(obj.provNum)
  const lengthMinutes = Number(obj.lengthMinutes)
  if (!Number.isInteger(provNum) || provNum <= 0) return null
  if (!Number.isInteger(lengthMinutes) || lengthMinutes <= 0) return null
  const operatoryNums = dedupePositiveInts(
    Array.isArray(obj.operatoryNums) ? obj.operatoryNums.map((n) => Number(n)) : []
  )
  if (operatoryNums.length === 0) return null
  const visitTypes = Array.isArray(obj.visitTypes)
    ? obj.visitTypes
        .map(coerceVisitTypeMapping)
        .filter((v): v is VisitTypeMapping => v !== null)
    : []
  // Support legacy string[] visitTypes saved before alias objects existed.
  if (visitTypes.length === 0 && Array.isArray(obj.visitTypes)) {
    for (const item of obj.visitTypes) {
      if (typeof item === 'string' && item.trim()) {
        visitTypes.push({ visitType: item.trim(), aliases: [] })
      }
    }
  }
  // Empty visitTypes is valid: that row is the default booking target (pre visit-type routing).
  return { provNum, operatoryNums, lengthMinutes, visitTypes }
}

/** Multi-provider OD read configs, or a single legacy-derived row. */
export function resolveOdReadConfigs(settings: SchedulingSettings): OdReadSlotConfig[] {
  const fromNew = Array.isArray(settings.odReadSlotConfigs)
    ? settings.odReadSlotConfigs
        .map(coerceOdReadSlotConfig)
        .filter((c): c is OdReadSlotConfig => c !== null)
    : []
  if (fromNew.length > 0) return fromNew

  const provNum = resolveReadProvNum(settings)
  const operatoryNums = resolveReadOperatoryNums(settings)
  const lengthMinutes = resolveReadLengthMinutes(settings) ?? 30
  if (!provNum || operatoryNums.length === 0) return []
  return [{ provNum, operatoryNums, lengthMinutes }]
}

/** Multi-provider OD booking configs, or a single legacy-derived row without visit types. */
export function resolveOdBookConfigs(settings: SchedulingSettings): OdBookSlotConfig[] {
  const fromNew = Array.isArray(settings.odBookSlotConfigs)
    ? settings.odBookSlotConfigs
        .map(coerceOdBookSlotConfig)
        .filter((c): c is OdBookSlotConfig => c !== null)
    : []
  if (fromNew.length > 0) return fromNew

  // Legacy single booking defaults (no visit-type routing).
  const primary = settings.defaultOperatoryNum
  const additional = settings.defaultOperatoryNums ?? []
  const operatoryNums =
    primary && primary > 0
      ? dedupePositiveInts([primary, ...additional])
      : dedupePositiveInts(additional)
  const provNum = settings.defaultProvNum
  const lengthMinutes = settings.defaultLengthMinutes ?? 30
  if (!provNum || provNum <= 0 || operatoryNums.length === 0) return []
  return [{ provNum, operatoryNums, lengthMinutes, visitTypes: [] }]
}

/** Flatten all configured visit-type mappings across booking rows. */
export function listConfiguredVisitTypeMappings(settings: SchedulingSettings): VisitTypeMapping[] {
  const out: VisitTypeMapping[] = []
  const seen = new Set<string>()
  for (const config of resolveOdBookConfigs(settings)) {
    for (const mapping of config.visitTypes) {
      const key = normalizeVisitTypeKey(mapping.visitType)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(mapping)
    }
  }
  return out
}

/**
 * Map agent/natural-language appointment text to a canonical EHR visit type.
 * Match order: exact visit type → exact alias → normalized contains / token overlap.
 */
export function resolveVisitTypeFromNaturalLanguage(
  settings: SchedulingSettings,
  text: string
): string | null {
  const raw = text?.trim()
  if (!raw) return null
  const mappings = listConfiguredVisitTypeMappings(settings)
  if (mappings.length === 0) return null

  const normalized = normalizeVisitTypeKey(raw)
  if (!normalized) return null

  for (const mapping of mappings) {
    if (normalizeVisitTypeKey(mapping.visitType) === normalized) return mapping.visitType
  }
  for (const mapping of mappings) {
    for (const alias of mapping.aliases) {
      if (normalizeVisitTypeKey(alias) === normalized) return mapping.visitType
    }
  }

  let best: { visitType: string; score: number } | null = null
  const inputTokens = new Set(tokenizeVisitTypeKey(raw))
  for (const mapping of mappings) {
    const candidates = [mapping.visitType, ...mapping.aliases]
    for (const candidate of candidates) {
      const candNorm = normalizeVisitTypeKey(candidate)
      if (!candNorm) continue
      let score = 0
      if (normalized.includes(candNorm) || candNorm.includes(normalized)) {
        score = Math.max(score, Math.min(normalized.length, candNorm.length))
      }
      const candTokens = tokenizeVisitTypeKey(candidate)
      if (candTokens.length > 0) {
        const overlap = candTokens.filter((t) => inputTokens.has(t)).length
        if (overlap > 0) {
          score = Math.max(score, overlap * 10 + overlap / candTokens.length)
        }
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { visitType: mapping.visitType, score }
      }
    }
  }
  return best?.visitType ?? null
}

export function resolveBookConfigForVisitType(
  settings: SchedulingSettings,
  visitType: string
): OdBookSlotConfig | null {
  const key = normalizeVisitTypeKey(visitType)
  if (!key) return null
  for (const config of resolveOdBookConfigs(settings)) {
    if (config.visitTypes.some((vt) => normalizeVisitTypeKey(vt.visitType) === key)) {
      return config
    }
  }
  return null
}

/**
 * Read configs for a visit type (via booking-row provider), or all read configs when
 * visit type is omitted / unmatched.
 */
export function resolveReadConfigsForVisitType(
  settings: SchedulingSettings,
  visitType?: string | null
): OdReadSlotConfig[] {
  const all = resolveOdReadConfigs(settings)
  if (!visitType?.trim()) return all
  const book = resolveBookConfigForVisitType(settings, visitType)
  if (!book) return all
  const forProvider = all.filter((row) => row.provNum === book.provNum)
  return forProvider.length > 0 ? forProvider : all
}

/** Prefer slot operatory when it is an allowed write target; otherwise first write op. */
export function resolveWriteOperatoryForBooking(
  bookConfig: OdBookSlotConfig,
  preferredOpNum?: number | null
): number | null {
  if (
    preferredOpNum &&
    Number.isInteger(preferredOpNum) &&
    bookConfig.operatoryNums.includes(preferredOpNum)
  ) {
    return preferredOpNum
  }
  return bookConfig.operatoryNums[0] ?? null
}

/** Mirror first OD config rows back onto legacy single-default fields for older readers. */
export function mirrorOdConfigsToLegacyDefaults(settings: SchedulingSettings): SchedulingSettings {
  const read = resolveOdReadConfigs(settings)[0]
  const book = resolveOdBookConfigs(settings)[0]
  return {
    ...settings,
    defaultReadProvNum: read?.provNum ?? settings.defaultReadProvNum ?? null,
    defaultReadOperatoryNum: read?.operatoryNums[0] ?? settings.defaultReadOperatoryNum ?? null,
    defaultReadOperatoryNums: read?.operatoryNums.slice(1) ?? settings.defaultReadOperatoryNums ?? [],
    defaultReadLengthMinutes: read?.lengthMinutes ?? settings.defaultReadLengthMinutes ?? null,
    defaultProvNum: book?.provNum ?? settings.defaultProvNum ?? null,
    defaultOperatoryNum: book?.operatoryNums[0] ?? settings.defaultOperatoryNum ?? null,
    defaultOperatoryNums: book?.operatoryNums.slice(1) ?? settings.defaultOperatoryNums ?? [],
    defaultLengthMinutes: book?.lengthMinutes ?? settings.defaultLengthMinutes ?? null,
  }
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

function dedupePractitionerRefs(refs: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const ref of refs) {
    const trimmed = ref.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

/** Explicit eCW practitioner filter from scheduling settings (empty = use all practitioners). */
export function resolveReadPractitionerRefs(settings: SchedulingSettings): string[] {
  const refs: string[] = []
  if (Array.isArray(settings.defaultReadPractitionerRefs)) {
    refs.push(...settings.defaultReadPractitionerRefs)
  }
  if (settings.defaultReadPractitionerRef) {
    refs.push(settings.defaultReadPractitionerRef)
  }
  const deduped = dedupePractitionerRefs(refs)
  if (deduped.length > 0) return deduped
  if (settings.defaultWritePractitionerRef) {
    return [settings.defaultWritePractitionerRef]
  }
  return []
}

export function resolveReadPractitionerRef(settings: SchedulingSettings): string | null {
  return resolveReadPractitionerRefs(settings)[0] ?? null
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
