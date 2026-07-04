import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import {
  getEhrSettings,
  getEcwClientAssertionAud,
  getPrivateKeyJwtConfig,
} from '@/lib/integrations/ehr/server'
import { createClientAssertion } from '@/lib/integrations/ehr/smartEngine'
import { FhirClient } from '@/lib/integrations/fhir/fhirClient'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'
import { getEcwDefaultLocationOrganizationForIssuer } from '@/lib/integrations/ehr/writeback'
import { enrichPatientsAfterScheduleSync } from '@/lib/integrations/ehr/enrichScheduleSyncPatients'
import { handleAppointmentChangeForSlotFill } from '@/lib/appointment-optimization/appointmentChangeHandler'
import { getSchedulingSettings } from '@/lib/integrations/clinical-system/server'
import {
  resolveReadPractitionerRefs,
  type SchedulingSettings,
} from '@/lib/integrations/clinical-system/types'

const WRITEBACK_PROVIDER_ID = 'ecw_write'
const STALE_SYNC_WINDOW_MS = 12 * 60 * 60 * 1000
const SYNC_TIMEZONE = 'America/Chicago'
/** eCW schedule sync can fan out across practitioners × days; allow longer FHIR reads. */
const ECW_SYNC_TIMEOUT_MS = 60_000
/** Default forward horizon (calendar days, includes weekends) when practice config does not override. */
const DEFAULT_SYNC_CALENDAR_DAYS = 14

const DEFAULT_SCHEDULE_PRACTITIONER_FFBJCD =
  'Practitioner/Lt2IFR5Ah76n4d8TFP5gBPiX1g1-Q2P9s8IYoGZvbFM'
const DEFAULT_SCHEDULE_PRACTITIONER_FACGCD =
  'Practitioner/W6s8TGka96L4tHbCRoQU8YMH.WUkwA2pU9wsHWwur0c'

type FhirEncounter = {
  id?: string
  status?: string
  period?: { start?: string; end?: string }
  subject?: { reference?: string }
  participant?: Array<{ individual?: { reference?: string } }>
  type?: Array<{ text?: string; coding?: Array<{ display?: string }> }>
  reasonCode?: Array<{ text?: string; coding?: Array<{ display?: string }> }>
}

type FhirBundle<TResource = any> = {
  entry?: Array<{ resource?: TResource }>
  link?: Array<{ relation?: string; url?: string }>
}

type FhirPatient = {
  id?: string
  name?: Array<{ text?: string; family?: string; given?: string[] }>
  birthDate?: string
  gender?: string
  telecom?: Array<{ system?: string; value?: string }>
}

export type SyncOptions = {
  force?: boolean
  /** Number of upcoming calendar days (Chicago, includes weekends) when startDate/endDate are omitted. */
  businessDays?: number
  /** Inclusive calendar start (YYYY-MM-DD, Chicago). */
  startDate?: string
  /** Inclusive calendar end (YYYY-MM-DD, Chicago). */
  endDate?: string
}

export type EhrAppointmentSyncStatus = {
  lastCompleteAt: string | null
  lastCompleteMetadata: Record<string, unknown> | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
}

export type EhrPractitionerOption = {
  id: string
  reference: string
  name: string
}

type FhirPractitioner = {
  id?: string
  name?: Array<{ text?: string; family?: string; given?: string[] }>
}

type FhirPractitionerRole = {
  id?: string
  practitioner?: { reference?: string }
  organization?: { reference?: string }
  code?: Array<{ coding?: Array<{ display?: string; code?: string }>; text?: string }>
  location?: Array<{ reference?: string }>
}

export type EhrTelephoneEncounterRefsFromPractitioner = {
  /** participant + assignedTo always match the resolved Practitioner */
  participantPractitionerRef: string
  assignedToPractitionerRef: string
  /** From PractitionerRole (requires system/PractitionerRole.read). */
  locationRefFromRole: string | null
  organizationRefFromRole: string | null
  /**
   * Values to pass to telephone Encounter build: role-derived when present, else issuer defaults
   * (same as writeback `ECW_TELEPHONE_REFS_*` for FACGCD/FFBJCD).
   */
  effectiveLocationRef: string
  effectiveOrganizationRef: string
  notes: string[]
}

export type EhrPractitionerDetail = {
  reference: string
  practitioner: FhirPractitioner & { id: string }
  roles: FhirPractitionerRole[]
  /** eCW mishandles path reads when Practitioner.id contains "."; use `_id` search instead. */
  practitionerRequestPath: string
  practitionerRoleRequestPath: string
  telephoneEncounterRefs: EhrTelephoneEncounterRefsFromPractitioner
}

function normalizePractitionerReference(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('Practitioner/')) return trimmed
  if (trimmed.includes('/')) return null
  return `Practitioner/${trimmed}`
}

function normalizeLocationOrOrganizationRef(value: string | undefined, resourceType: 'Location' | 'Organization') {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  if (trimmed.startsWith(`${resourceType}/`)) return trimmed
  if (trimmed.includes('/')) return null
  return `${resourceType}/${trimmed}`
}

function buildTelephoneEncounterRefsForPractitioner(
  practitionerCanonicalRef: string,
  roles: FhirPractitionerRole[],
  issuer: string
): EhrTelephoneEncounterRefsFromPractitioner {
  let locationRefFromRole: string | null = null
  let organizationRefFromRole: string | null = null

  for (const role of roles) {
    if (!organizationRefFromRole) {
      organizationRefFromRole = normalizeLocationOrOrganizationRef(
        role.organization?.reference,
        'Organization'
      )
    }
    if (!locationRefFromRole) {
      const loc = role.location?.[0]?.reference
      locationRefFromRole = normalizeLocationOrOrganizationRef(loc, 'Location')
    }
    if (locationRefFromRole && organizationRefFromRole) break
  }

  const fallback = getEcwDefaultLocationOrganizationForIssuer(issuer)
  const notes: string[] = []

  const effectiveLocationRef =
    locationRefFromRole || fallback?.locationRef || ''
  const effectiveOrganizationRef =
    organizationRefFromRole || fallback?.organizationRef || ''

  if (!locationRefFromRole && fallback?.locationRef) {
    notes.push('locationRef: using issuer bundled default (PractitionerRole missing or no location)')
  }
  if (!organizationRefFromRole && fallback?.organizationRef) {
    notes.push('organizationRef: using issuer bundled default (PractitionerRole missing or no organization)')
  }
  if (roles.length === 0) {
    notes.push('PractitionerRole bundle was empty — ensure token includes system/PractitionerRole.read')
  }
  if (!effectiveLocationRef || !effectiveOrganizationRef) {
    notes.push('Set ecwTelephoneLocationRef and ecwTelephoneOrganizationRef in practice EHR settings.')
  }

  return {
    participantPractitionerRef: practitionerCanonicalRef,
    assignedToPractitionerRef: practitionerCanonicalRef,
    locationRefFromRole,
    organizationRefFromRole,
    effectiveLocationRef,
    effectiveOrganizationRef,
    notes,
  }
}

function inferDefaultPractitionerRef(issuer: string) {
  const normalized = issuer.toLowerCase()
  if (normalized.includes('/facgcd')) return DEFAULT_SCHEDULE_PRACTITIONER_FACGCD
  return DEFAULT_SCHEDULE_PRACTITIONER_FFBJCD
}

function parseExplicitPractitionerRefsFromConfig(config: Record<string, unknown>) {
  const explicitRefs = typeof config.ecwSchedulePractitionerRefs === 'string'
    ? config.ecwSchedulePractitionerRefs
        .split(',')
        .map((value) => normalizePractitionerReference(value))
        .filter((value): value is string => Boolean(value))
    : []
  if (explicitRefs.length > 0) {
    return Array.from(new Set(explicitRefs))
  }

  const participantRef = typeof config.ecwTelephoneParticipantPractitionerRef === 'string'
    ? normalizePractitionerReference(config.ecwTelephoneParticipantPractitionerRef)
    : null
  if (participantRef) {
    return [participantRef]
  }

  return []
}

function parsePractitionerRefsFromConfig(config: Record<string, unknown>, issuer: string) {
  const explicit = parseExplicitPractitionerRefsFromConfig(config)
  if (explicit.length > 0) {
    return explicit
  }
  return [inferDefaultPractitionerRef(issuer)]
}

function dedupePractitionerReferences(refs: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const ref of refs) {
    const normalized = normalizePractitionerReference(ref)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

export function collectExplicitEcwPractitionerRefs(
  writeConfig: Record<string, unknown>,
  scheduling?: SchedulingSettings
): string[] {
  const refs: string[] = [
    ...parseExplicitPractitionerRefsFromConfig(writeConfig),
    ...(scheduling ? resolveReadPractitionerRefs(scheduling) : []),
  ]

  for (const key of [
    'ecwTelephonePractitionerRef',
    'ecwTelephoneParticipantPractitionerRef',
    'ecwTelephoneAssignedToPractitionerRef',
  ]) {
    const normalized = normalizePractitionerReference(
      typeof writeConfig[key] === 'string' ? writeConfig[key] : ''
    )
    if (normalized) refs.push(normalized)
  }

  return dedupePractitionerReferences(refs)
}

async function getEcwPractitionerRefsFromAppointments(practiceId: string): Promise<string[]> {
  const rows = await prisma.appointment.groupBy({
    by: ['providerId'],
    where: {
      practiceId,
      providerId: { not: null },
    },
  })

  return dedupePractitionerReferences(
    rows
      .map((row) => row.providerId || '')
      .filter(Boolean)
  )
}

function getExplicitEcwScheduleScopeRefs(writeConfig: Record<string, unknown>) {
  const organizationRef = normalizeLocationOrOrganizationRef(
    typeof writeConfig.ecwTelephoneOrganizationRef === 'string'
      ? writeConfig.ecwTelephoneOrganizationRef
      : typeof writeConfig.ecwScheduleOrganizationRef === 'string'
        ? writeConfig.ecwScheduleOrganizationRef
        : undefined,
    'Organization'
  )
  const locationRef = normalizeLocationOrOrganizationRef(
    typeof writeConfig.ecwTelephoneLocationRef === 'string'
      ? writeConfig.ecwTelephoneLocationRef
      : typeof writeConfig.ecwScheduleLocationRef === 'string'
        ? writeConfig.ecwScheduleLocationRef
        : undefined,
    'Location'
  )
  return { organizationRef, locationRef }
}

async function fetchPractitionerRefsFromRoleSearch(
  client: FhirClient,
  params: Record<string, string>
): Promise<string[]> {
  const search = new URLSearchParams(params)
  let nextPath: string | undefined = sanitizeEcwFhirRequestPath(
    `/PractitionerRole?${search.toString()}`
  )
  const refs = new Set<string>()

  while (nextPath) {
    const responseBundle: FhirBundle<FhirPractitionerRole> = await client.request(nextPath)
    for (const entry of responseBundle.entry || []) {
      const normalized = normalizePractitionerReference(entry.resource?.practitioner?.reference || '')
      if (normalized) refs.add(normalized)
    }
    const nextLink = responseBundle.link?.find((link) => link.relation === 'next')?.url
    nextPath = nextLink ? sanitizeEcwFhirRequestPath(nextLink) : undefined
  }

  return Array.from(refs)
}

/** Resolve eCW practitioners scoped to this CRM practice — never the full tenant directory. */
export async function resolveEcwPractitionerRefsForPractice(
  practiceId: string,
  options?: {
    scheduling?: SchedulingSettings
    explicitRefs?: string[]
    client?: FhirClient
    issuer?: string
    writeConfig?: Record<string, unknown>
  }
): Promise<string[]> {
  const explicitOverride = dedupePractitionerReferences(options?.explicitRefs ?? [])
  if (explicitOverride.length > 0) {
    return explicitOverride
  }

  const settings = await getEhrSettings(practiceId)
  const writeConfig =
    options?.writeConfig ||
    ((settings?.providerConfigs?.[WRITEBACK_PROVIDER_ID] as Record<string, unknown> | undefined) ||
      {})
  const scheduling = options?.scheduling ?? (await getSchedulingSettings(practiceId))

  const configuredRefs = collectExplicitEcwPractitionerRefs(writeConfig, scheduling)
  if (configuredRefs.length > 0) {
    return configuredRefs
  }

  const appointmentRefs = await getEcwPractitionerRefsFromAppointments(practiceId)
  if (appointmentRefs.length > 0) {
    return appointmentRefs
  }

  const { organizationRef, locationRef } = getExplicitEcwScheduleScopeRefs(writeConfig)
  if (options?.client && (organizationRef || locationRef)) {
    const scopedRefs = new Set<string>()
    if (organizationRef) {
      for (const ref of await fetchPractitionerRefsFromRoleSearch(options.client, {
        organization: organizationRef,
      })) {
        scopedRefs.add(ref)
      }
    }
    if (locationRef) {
      for (const ref of await fetchPractitionerRefsFromRoleSearch(options.client, {
        location: locationRef,
      })) {
        scopedRefs.add(ref)
      }
    }
    if (scopedRefs.size > 0) {
      return Array.from(scopedRefs)
    }
  }

  const issuer =
    options?.issuer ||
    (await createEhrClientForPractice(practiceId, { timeoutMs: ECW_SYNC_TIMEOUT_MS }))?.connection
      .issuer ||
    ''
  return parsePractitionerRefsFromConfig(writeConfig, issuer)
}

/** Resolve which eCW practitioners to pull schedule data for (settings → config → all → issuer default). */
export async function resolveEcwSchedulePractitionerRefs(
  practiceId: string,
  options?: {
    scheduling?: SchedulingSettings
    explicitRefs?: string[]
  }
): Promise<string[]> {
  const ehrContext = await createEhrClientForPractice(practiceId, { timeoutMs: ECW_SYNC_TIMEOUT_MS })
  const settings = await getEhrSettings(practiceId)
  const writeConfig =
    (settings?.providerConfigs?.[WRITEBACK_PROVIDER_ID] as Record<string, unknown> | undefined) || {}

  return resolveEcwPractitionerRefsForPractice(practiceId, {
    scheduling: options?.scheduling ?? (await getSchedulingSettings(practiceId)),
    explicitRefs: options?.explicitRefs,
    client: ehrContext?.client,
    issuer: ehrContext?.connection.issuer,
    writeConfig,
  })
}

function formatTzDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function getUpcomingCalendarDays(count: number, timeZone = SYNC_TIMEZONE) {
  const days: string[] = []
  const cursor = new Date()

  while (days.length < count) {
    days.push(formatTzDate(cursor, timeZone))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return days
}

function parseSyncHorizonDaysFromConfig(config: Record<string, unknown>) {
  const raw = config.ecwScheduleSyncBusinessDays ?? config.ecwScheduleSyncDays
  if (typeof raw === 'number' && raw > 0 && raw <= 90) return Math.floor(raw)
  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10)
    if (parsed > 0 && parsed <= 90) return parsed
  }
  return DEFAULT_SYNC_CALENDAR_DAYS
}

function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** Every calendar day from start through end (inclusive), in Chicago dates. */
function getCalendarDaysInRange(startDate: string, endDate: string, timeZone = SYNC_TIMEZONE) {
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    return []
  }
  const days: string[] = []
  const cursor = new Date(`${startDate}T12:00:00.000Z`)
  const end = new Date(`${endDate}T12:00:00.000Z`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) {
    return []
  }

  while (cursor <= end) {
    days.push(formatTzDate(cursor, timeZone))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

function resolveSyncDays(options: SyncOptions, configSyncDays: number) {
  if (options.startDate && options.endDate) {
    const rangeDays = getCalendarDaysInRange(options.startDate, options.endDate)
    if (rangeDays.length > 0) return rangeDays
  }

  const syncDays = options.businessDays ?? configSyncDays
  return getUpcomingCalendarDays(syncDays, SYNC_TIMEZONE)
}

function buildEncounterScheduleQuery(practitionerRef: string, day: string) {
  const nextDay = addUtcDay(day)
  // eCW rejects _count on Encounter search (OperationOutcome 400).
  return `/Encounter?practitioner=${encodeURIComponent(
    practitionerRef
  )}&date=ge${day}&date=lt${nextDay}`
}

/** eCW tenants often reject `_count`; strip it from paths and pagination next links. */
export function sanitizeEcwFhirRequestPath(pathOrUrl: string) {
  try {
    const isAbsolute = pathOrUrl.startsWith('http')
    const url = new URL(
      isAbsolute
        ? pathOrUrl
        : `https://ecw.local${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
    )
    url.searchParams.delete('_count')
    const search = url.searchParams.toString()
    if (isAbsolute) {
      url.search = search
      return url.toString()
    }
    return `${url.pathname}${search ? `?${search}` : ''}`
  } catch {
    return pathOrUrl
      .replace(/([?&])_count=[^&]*(?=&|$)/g, '$1')
      .replace(/\?&/, '?')
      .replace(/[?&]$/, '')
  }
}

function addUtcDay(dateString: string) {
  const date = new Date(`${dateString}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function normalizeEhrPatientId(value: string | undefined | null) {
  if (!value) return null
  let normalized = value.trim()
  if (!normalized) return null
  try {
    normalized = decodeURIComponent(normalized)
  } catch {
    // Keep raw value when decoding fails.
  }
  normalized = normalized.split('?')[0].split('#')[0].replace(/^\/+/, '')

  if (normalized.startsWith('Patient/')) {
    normalized = normalized.slice('Patient/'.length)
  } else {
    const marker = '/Patient/'
    const markerIndex = normalized.lastIndexOf(marker)
    if (markerIndex >= 0) {
      normalized = normalized.slice(markerIndex + marker.length)
    }
  }

  const historyIndex = normalized.indexOf('/_history/')
  if (historyIndex >= 0) {
    normalized = normalized.slice(0, historyIndex)
  }

  normalized = normalized.split('/')[0].trim()
  return normalized || null
}

function parsePatientIdFromReference(reference: string | undefined) {
  return normalizeEhrPatientId(reference)
}

function formatPatientName(patient: FhirPatient) {
  const name = patient.name?.[0]
  if (!name) return null
  if (name.text?.trim()) return name.text.trim()
  const combined = [...(name.given || []), name.family || ''].filter(Boolean).join(' ').trim()
  return combined || null
}

function mapEncounterStatusToAppointment(status: string | undefined) {
  switch (status) {
    case 'arrived':
    case 'triaged':
    case 'in-progress':
      return 'confirmed'
    case 'finished':
      return 'completed'
    case 'cancelled':
      return 'cancelled'
    case 'planned':
    default:
      return 'scheduled'
  }
}

function getEncounterVisitType(encounter: FhirEncounter) {
  return (
    encounter.type?.[0]?.text ||
    encounter.type?.[0]?.coding?.[0]?.display ||
    'EHR Appointment'
  )
}

function getEncounterReason(encounter: FhirEncounter) {
  return encounter.reasonCode?.[0]?.text || encounter.reasonCode?.[0]?.coding?.[0]?.display || null
}

async function fetchEncounterPages(client: FhirClient, initialPath: string) {
  const encounters: FhirEncounter[] = []
  let nextPath: string | undefined = sanitizeEcwFhirRequestPath(initialPath)

  while (nextPath) {
    const responseBundle: FhirBundle<FhirEncounter> = await client.request(nextPath)
    for (const entry of responseBundle.entry || []) {
      if (entry.resource?.id) {
        encounters.push(entry.resource)
      }
    }
    const nextLink = responseBundle.link?.find((link) => link.relation === 'next')?.url
    nextPath = nextLink ? sanitizeEcwFhirRequestPath(nextLink) : undefined
  }

  return encounters
}

function formatPractitionerName(practitioner: FhirPractitioner) {
  const name = practitioner.name?.[0]
  if (!name) return null
  if (name.text?.trim()) return name.text.trim()
  const combined = [...(name.given || []), name.family || ''].filter(Boolean).join(' ').trim()
  return combined || null
}

/**
 * eClinicalWorks lists Practitioner and PractitionerRole under USCDI read APIs; we call the
 * standard FHIR R4 endpoints on the tenant base URL from SMART configuration.
 *
 * - Practitioner (read): https://fhir.eclinicalworks.com/ecwopendev/documentation/v3-read-resources?name=Practitioner
 * - PractitionerRole (read): https://fhir.eclinicalworks.com/ecwopendev/documentation/v3-read-resources?name=PractitionerRole
 *
 * Interactions used here:
 * - Type search (list): GET `{base}/Practitioner` — follow `Bundle.link.relation === "next"`.
 * - Read by id (spec): GET `{base}/Practitioner/{id}` — often fails on eCW when `{id}` contains `.`;
 *   use type search GET `{base}/Practitioner?_id={encodedId}` instead (no `_count` on eCW).
 * - Roles for a practitioner: GET `{base}/PractitionerRole?practitioner=Practitioner/{id}`.
 *
 * Supported search parameters vary by tenant; use GET `{base}/metadata` to confirm.
 */
async function fetchPractitionerPages(client: FhirClient, initialPath: string) {
  const practitioners: FhirPractitioner[] = []
  let nextPath: string | undefined = sanitizeEcwFhirRequestPath(initialPath)

  while (nextPath) {
    const responseBundle: FhirBundle<FhirPractitioner> = await client.request(nextPath)
    for (const entry of responseBundle.entry || []) {
      if (entry.resource?.id) {
        practitioners.push(entry.resource)
      }
    }
    const nextLink = responseBundle.link?.find((link) => link.relation === 'next')?.url
    nextPath = nextLink ? sanitizeEcwFhirRequestPath(nextLink) : undefined
  }

  return practitioners
}

/**
 * Prefer this over `GET /Practitioner/{id}` on eCW: dotted ids often return
 * OperationOutcome ("String index out of range: -1").
 */
async function fetchPractitionerByIdSearch(client: FhirClient, practitionerId: string) {
  const path = sanitizeEcwFhirRequestPath(
    `/Practitioner?_id=${encodeURIComponent(practitionerId)}`
  )
  const responseBundle: FhirBundle<FhirPractitioner> = await client.request(path)
  const resource = responseBundle.entry?.[0]?.resource
  return resource?.id ? resource : null
}

async function fetchPractitionerRolesForRef(client: FhirClient, practitionerRef: string) {
  const roles: FhirPractitionerRole[] = []
  const params = new URLSearchParams({ practitioner: practitionerRef })
  let nextPath: string | undefined = sanitizeEcwFhirRequestPath(
    `/PractitionerRole?${params.toString()}`
  )

  while (nextPath) {
    const responseBundle: FhirBundle<FhirPractitionerRole> = await client.request(nextPath)
    for (const entry of responseBundle.entry || []) {
      if (entry.resource?.id) {
        roles.push(entry.resource)
      }
    }
    const nextLink = responseBundle.link?.find((link) => link.relation === 'next')?.url
    nextPath = nextLink ? sanitizeEcwFhirRequestPath(nextLink) : undefined
  }

  return roles
}

/** Resolve practitioner + roles using search endpoints (eCW-safe for dotted ids). */
export async function fetchEhrPractitionerDetailForPractice(
  practiceId: string,
  practitionerRefInput: string,
  options?: { timeoutMs?: number }
): Promise<EhrPractitionerDetail | null> {
  const normalizedRef = normalizePractitionerReference(practitionerRefInput.trim())
  if (!normalizedRef) {
    return null
  }
  const practitionerId = normalizedRef.replace(/^Practitioner\//, '')
  const ehrContext = await createEhrClientForPractice(practiceId, {
    timeoutMs: options?.timeoutMs ?? 60_000,
  })
  if (!ehrContext) {
    return null
  }

  const { client, connection } = ehrContext
  const practitionerRequestPath = sanitizeEcwFhirRequestPath(
    `/Practitioner?_id=${encodeURIComponent(practitionerId)}`
  )
  const practitioner = await fetchPractitionerByIdSearch(client, practitionerId)
  if (!practitioner?.id) {
    return null
  }

  const canonicalRef = `Practitioner/${practitioner.id}`
  const roleParams = new URLSearchParams({ practitioner: canonicalRef })
  const practitionerRoleRequestPath = sanitizeEcwFhirRequestPath(
    `/PractitionerRole?${roleParams.toString()}`
  )

  let roles: FhirPractitionerRole[] = []
  try {
    roles = await fetchPractitionerRolesForRef(client, canonicalRef)
  } catch {
    roles = []
  }

  const telephoneEncounterRefs = buildTelephoneEncounterRefsForPractitioner(
    canonicalRef,
    roles,
    connection.issuer
  )

  return {
    reference: canonicalRef,
    practitioner: { ...practitioner, id: practitioner.id },
    roles,
    practitionerRequestPath,
    practitionerRoleRequestPath,
    telephoneEncounterRefs,
  }
}

/** Test route helper: roles + paths for one practitioner (backed by detail fetch). */
export async function fetchEhrPractitionerRolesOnlyForPractice(
  practiceId: string,
  practitionerRefInput: string,
  options?: { timeoutMs?: number }
) {
  const detail = await fetchEhrPractitionerDetailForPractice(practiceId, practitionerRefInput, options)
  if (!detail) return null
  return {
    reference: detail.reference,
    practitioner: detail.practitioner,
    roles: detail.roles,
    pagesScanned: 1,
    practitionerRequestPath: detail.practitionerRequestPath,
    practitionerRoleRequestPath: detail.practitionerRoleRequestPath,
    telephoneEncounterRefs: detail.telephoneEncounterRefs,
  }
}

export type FacgcdPractitionerDirectoryEntry = {
  reference: string
  practitionerId: string
  formattedName: string
  practitionerRoleIds: string[]
  organizationReferences: string[]
  locationReferences: string[]
}

/**
 * Test route helper: practitioner list plus role/org/location summary per practitioner
 * (bounded by maxPractitionerPages for detail calls).
 */
export async function fetchFacgcdPractitionerDirectoryForPractice(
  practiceId: string,
  options?: { timeoutMs?: number; maxPractitionerPages?: number; maxRolePages?: number }
) {
  const ehrContext = await createEhrClientForPractice(practiceId, { timeoutMs: options?.timeoutMs ?? 60_000 })
  if (!ehrContext) return null

  const list = await listEhrPractitionersForPractice(practiceId)
  const maxDetails = Math.min(list.length, Math.max(1, options?.maxPractitionerPages ?? 200))
  const entries: FacgcdPractitionerDirectoryEntry[] = []
  let rolePageBuckets = 0

  for (let i = 0; i < maxDetails; i++) {
    const opt = list[i]
    const d = await fetchEhrPractitionerDetailForPractice(practiceId, opt.reference, {
      timeoutMs: options?.timeoutMs,
    })
    if (!d) continue
    rolePageBuckets += 1
    const orgRefs: string[] = []
    const locRefs: string[] = []
    for (const r of d.roles) {
      const o = r.organization?.reference
      if (o) orgRefs.push(o)
      for (const loc of r.location || []) {
        const ref = loc?.reference
        if (ref) locRefs.push(ref)
      }
    }
    const pid = d.practitioner.id
    if (!pid) continue
    entries.push({
      reference: d.reference,
      practitionerId: pid,
      formattedName: formatPractitionerName(d.practitioner) || opt.name,
      practitionerRoleIds: d.roles.map((r) => r.id).filter((id): id is string => Boolean(id)),
      organizationReferences: [...new Set(orgRefs)],
      locationReferences: [...new Set(locRefs)],
    })
  }

  const practitionerRoleCount = entries.reduce((acc, e) => acc + e.practitionerRoleIds.length, 0)

  return {
    issuer: ehrContext.connection.issuer,
    practitionerInitialPath: '/Practitioner',
    practitionerPagesScanned: 1,
    practitionerRolePagesScanned: rolePageBuckets,
    practitionerCount: list.length,
    practitionerRoleCount,
    entries,
  }
}

async function upsertPatientFromEhr(params: {
  practiceId: string
  client: FhirClient
  patientId: string
  cache: Map<string, string>
}) {
  const normalizedPatientId = normalizeEhrPatientId(params.patientId)
  if (!normalizedPatientId) {
    throw new Error('Invalid EHR patient identifier')
  }

  const cached = params.cache.get(normalizedPatientId)
  if (cached) {
    return cached
  }

  const existing = await prisma.patient.findFirst({
    where: {
      practiceId: params.practiceId,
      deletedAt: null,
      OR: [
        { externalEhrId: normalizedPatientId },
        { externalEhrId: `Patient/${normalizedPatientId}` },
        { externalEhrId: { endsWith: `/Patient/${normalizedPatientId}` } },
        { externalEhrId: { startsWith: `Patient/${normalizedPatientId}/_history/` } },
      ],
    },
  })
  if (existing) {
    if (existing.externalEhrId !== normalizedPatientId) {
      await prisma.patient.update({
        where: { id: existing.id },
        data: { externalEhrId: normalizedPatientId },
      })
    }
    params.cache.set(normalizedPatientId, existing.id)
    return existing.id
  }

  let patient: FhirPatient | null = null
  try {
    patient = await params.client.request<FhirPatient>(`/Patient/${normalizedPatientId}`)
  } catch {
    patient = null
  }

  const fullName = formatPatientName(patient || {}) || `EHR Patient ${normalizedPatientId.slice(0, 8)}`
  const primaryPhone =
    patient?.telecom?.find((entry) => entry.system === 'phone')?.value?.trim() || null
  const email = patient?.telecom?.find((entry) => entry.system === 'email')?.value?.trim() || null
  const firstName = patient?.name?.[0]?.given?.[0] || null
  const lastName = patient?.name?.[0]?.family || null
  const birthDate = patient?.birthDate ? new Date(patient.birthDate) : null

  // Before creating a new profile, merge with an existing local patient match and attach EHR ID.
  const mergeOrConditions: Array<Record<string, unknown>> = []
  if (email) {
    mergeOrConditions.push({ email: { equals: email, mode: 'insensitive' } })
  }
  if (primaryPhone) {
    mergeOrConditions.push({ primaryPhone })
    mergeOrConditions.push({ phone: primaryPhone })
  }
  if (fullName && birthDate) {
    mergeOrConditions.push({
      AND: [{ name: { equals: fullName, mode: 'insensitive' } }, { dateOfBirth: birthDate }],
    })
  }

  if (mergeOrConditions.length > 0) {
    const mergeCandidate = await prisma.patient.findFirst({
      where: {
        practiceId: params.practiceId,
        deletedAt: null,
        externalEhrId: null,
        OR: mergeOrConditions as any,
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (mergeCandidate) {
      const merged = await prisma.patient.update({
        where: { id: mergeCandidate.id },
        data: {
          externalEhrId: normalizedPatientId,
          firstName: mergeCandidate.firstName || firstName,
          lastName: mergeCandidate.lastName || lastName,
          name: mergeCandidate.name || fullName,
          dateOfBirth: mergeCandidate.dateOfBirth || birthDate,
          gender: mergeCandidate.gender || patient?.gender || null,
          primaryPhone: mergeCandidate.primaryPhone || primaryPhone,
          phone: mergeCandidate.phone || primaryPhone || mergeCandidate.phone,
          email: mergeCandidate.email || email,
          consentSource: mergeCandidate.consentSource || 'import',
        },
      })

      params.cache.set(normalizedPatientId, merged.id)
      return merged.id
    }
  }

  const created = await prisma.patient.create({
    data: {
      practiceId: params.practiceId,
      externalEhrId: normalizedPatientId,
      name: fullName,
      firstName,
      lastName,
      dateOfBirth: birthDate,
      gender: patient?.gender || null,
      primaryPhone,
      phone: primaryPhone || 'unknown',
      email,
      preferredContactMethod: primaryPhone ? 'phone' : 'email',
      consentSource: 'import',
    },
  })

  params.cache.set(normalizedPatientId, created.id)
  return created.id
}

async function getWritebackConnection(practiceId: string) {
  const connections = await prisma.ehrConnection.findMany({
    where: {
      tenantId: practiceId,
      providerId: WRITEBACK_PROVIDER_ID,
      authFlow: 'backend_services',
      status: 'connected',
      accessTokenEnc: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return connections[0] || null
}

export async function createEhrClientForPractice(
  practiceId: string,
  options?: { timeoutMs?: number }
) {
  const connection = await getWritebackConnection(practiceId)
  if (!connection?.accessTokenEnc) {
    return null
  }

  const refreshedConnection = await refreshBackendConnectionIfNeeded({ connection })
  if (!refreshedConnection.accessTokenEnc) {
    return null
  }
  const tokenEndpoint = refreshedConnection.tokenEndpoint || undefined
  const privateKeyConfig = tokenEndpoint ? getPrivateKeyJwtConfig(connection.providerId) : null
  const audOverride = connection.providerId.startsWith('ecw')
    ? getEcwClientAssertionAud(connection.issuer)
    : undefined

  const client = new FhirClient({
    baseUrl: refreshedConnection.fhirBaseUrl,
    tokenEndpoint,
    clientId: refreshedConnection.clientId,
    clientSecret:
      !privateKeyConfig && refreshedConnection.clientSecretEnc
        ? decryptString(refreshedConnection.clientSecretEnc)
        : undefined,
    clientAssertionProvider:
      privateKeyConfig && tokenEndpoint
        ? () =>
            createClientAssertion({
              clientId: refreshedConnection.clientId,
              tokenEndpoint,
              privateKeyPem: privateKeyConfig.privateKeyPem,
              keyId: privateKeyConfig.keyId,
              audience: audOverride,
            })
        : undefined,
    tokenState: {
      accessToken: decryptString(refreshedConnection.accessTokenEnc),
      refreshToken: refreshedConnection.refreshTokenEnc
        ? decryptString(refreshedConnection.refreshTokenEnc)
        : undefined,
      tokenType: undefined,
      expiresAt: refreshedConnection.expiresAt,
      scopes: refreshedConnection.scopesGranted || undefined,
    },
    onTokenRefresh: async (tokenResponse) => {
      await prisma.ehrConnection.update({
        where: { id: refreshedConnection.id },
        data: {
          accessTokenEnc: encryptString(tokenResponse.access_token),
          refreshTokenEnc: tokenResponse.refresh_token
            ? encryptString(tokenResponse.refresh_token)
            : refreshedConnection.refreshTokenEnc,
          expiresAt: tokenResponse.expires_in
            ? new Date(Date.now() + tokenResponse.expires_in * 1000)
            : refreshedConnection.expiresAt,
          scopesGranted: tokenResponse.scope || refreshedConnection.scopesGranted,
        },
      })
    },
    timeoutMs: options?.timeoutMs,
  })

  return { client, connection: refreshedConnection }
}

export async function getEhrAppointmentSyncStatusForPractice(
  practiceId: string
): Promise<EhrAppointmentSyncStatus> {
  const [lastComplete, lastError] = await Promise.all([
    prisma.integrationAuditLog.findFirst({
      where: { tenantId: practiceId, action: 'EHR_APPOINTMENT_SYNC_COMPLETE' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, metadata: true },
    }),
    prisma.integrationAuditLog.findFirst({
      where: { tenantId: practiceId, action: 'EHR_APPOINTMENT_SYNC_ERROR' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, metadata: true },
    }),
  ])

  const lastErrorMeta = lastError?.metadata as { error?: string } | null
  return {
    lastCompleteAt: lastComplete?.createdAt?.toISOString() ?? null,
    lastCompleteMetadata: (lastComplete?.metadata as Record<string, unknown> | null) ?? null,
    lastErrorAt: lastError?.createdAt?.toISOString() ?? null,
    lastErrorMessage:
      typeof lastErrorMeta?.error === 'string' ? lastErrorMeta.error.slice(0, 500) : null,
  }
}

async function upsertAppointmentFromEncounter(params: {
  practiceId: string
  client: FhirClient
  encounter: FhirEncounter
  practitionerRef: string
  patientCache: Map<string, string>
  touchedPatientIds?: Set<string>
}): Promise<'created' | 'updated' | 'skipped'> {
  const { practiceId, client, encounter, practitionerRef, patientCache } = params
  if (!encounter.id) return 'skipped'

  const patientEhrId = parsePatientIdFromReference(encounter.subject?.reference)
  if (!patientEhrId) return 'skipped'

  const start = encounter.period?.start ? new Date(encounter.period.start) : null
  if (!start || Number.isNaN(start.getTime())) return 'skipped'

  const end =
    encounter.period?.end && !Number.isNaN(new Date(encounter.period.end).getTime())
      ? new Date(encounter.period.end)
      : new Date(start.getTime() + 30 * 60 * 1000)
  const appointmentKey = `ehr:${encounter.id}`

  const patientId = await upsertPatientFromEhr({
    practiceId,
    client,
    patientId: patientEhrId,
    cache: patientCache,
  })
  params.touchedPatientIds?.add(patientId)
  const providerRef = encounter.participant?.[0]?.individual?.reference || practitionerRef

  const existing = await prisma.appointment.findUnique({
    where: { calBookingId: appointmentKey },
    select: {
      id: true,
      practiceId: true,
      providerId: true,
      status: true,
      startTime: true,
      endTime: true,
      timezone: true,
      visitType: true,
    },
  })

  const saved = await prisma.appointment.upsert({
    where: { calBookingId: appointmentKey },
    create: {
      practiceId,
      patientId,
      providerId: providerRef,
      status: mapEncounterStatusToAppointment(encounter.status),
      startTime: start,
      endTime: end,
      timezone: SYNC_TIMEZONE,
      visitType: getEncounterVisitType(encounter),
      reason: getEncounterReason(encounter),
      notes: `Synced from ECW Encounter/${encounter.id}`,
      calBookingId: appointmentKey,
      calEventId: 'ehr',
    },
    update: {
      patientId,
      providerId: providerRef,
      status: mapEncounterStatusToAppointment(encounter.status),
      startTime: start,
      endTime: end,
      timezone: SYNC_TIMEZONE,
      visitType: getEncounterVisitType(encounter),
      reason: getEncounterReason(encounter),
      notes: `Synced from ECW Encounter/${encounter.id}`,
    },
    select: {
      id: true,
      practiceId: true,
      providerId: true,
      status: true,
      startTime: true,
      endTime: true,
      timezone: true,
      visitType: true,
    },
  })

  await handleAppointmentChangeForSlotFill({ before: existing, after: saved })

  return existing ? 'updated' : 'created'
}

export async function syncEhrAppointmentsForPractice(practiceId: string, options: SyncOptions = {}) {
  const force = options.force === true

  if (!force) {
    const latestSync = await prisma.integrationAuditLog.findFirst({
      where: {
        tenantId: practiceId,
        action: 'EHR_APPOINTMENT_SYNC_COMPLETE',
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (latestSync && Date.now() - latestSync.createdAt.getTime() < STALE_SYNC_WINDOW_MS) {
      return { status: 'skipped' as const, reason: 'fresh_sync_exists' }
    }
  }

  const ehrContext = await createEhrClientForPractice(practiceId, { timeoutMs: ECW_SYNC_TIMEOUT_MS })
  if (!ehrContext) {
    return { status: 'skipped' as const, reason: 'missing_connection' }
  }
  const { client, connection } = ehrContext

  const settings = await getEhrSettings(practiceId)
  if (!settings?.enabledProviders?.includes(WRITEBACK_PROVIDER_ID as any)) {
    return { status: 'skipped' as const, reason: 'provider_disabled' }
  }
  const writeConfig =
    (settings?.providerConfigs?.[WRITEBACK_PROVIDER_ID] as Record<string, unknown> | undefined) || {}
  const practitionerRefs = await resolveEcwSchedulePractitionerRefs(practiceId, {
    scheduling: await getSchedulingSettings(practiceId),
  })
  if (practitionerRefs.length === 0) {
    return { status: 'skipped' as const, reason: 'missing_practitioner_refs' }
  }

  const configSyncDays = parseSyncHorizonDaysFromConfig(writeConfig)
  const days = resolveSyncDays(options, configSyncDays)
  if (days.length === 0) {
    return { status: 'skipped' as const, reason: 'invalid_date_range' }
  }

  const encounteredIds = new Set<string>()
  const patientCache = new Map<string, string>()
  const touchedPatientIds = new Set<string>()

  let synced = 0
  let created = 0
  let updated = 0
  let skipped = 0
  let dayErrors = 0

  for (const practitionerRef of practitionerRefs) {
    for (const day of days) {
      const query = buildEncounterScheduleQuery(practitionerRef, day)
      let encounters: FhirEncounter[] = []
      try {
        encounters = await fetchEncounterPages(client, query)
      } catch (error) {
        dayErrors += 1
        const message = error instanceof Error ? error.message : String(error)
        await logEhrAudit({
          tenantId: practiceId,
          actorUserId: null,
          action: 'EHR_APPOINTMENT_SYNC_ERROR',
          providerId: WRITEBACK_PROVIDER_ID,
          entity: 'Encounter',
          metadata: {
            practitionerRef,
            day,
            query,
            error: message,
          },
        })
        continue
      }

      for (const encounter of encounters) {
        if (!encounter.id || encounteredIds.has(encounter.id)) {
          skipped += 1
          continue
        }
        encounteredIds.add(encounter.id)

        const outcome = await upsertAppointmentFromEncounter({
          practiceId,
          client,
          encounter,
          practitionerRef,
          patientCache,
          touchedPatientIds,
        })
        if (outcome === 'skipped') {
          skipped += 1
          continue
        }
        synced += 1
        if (outcome === 'updated') updated += 1
        else created += 1
      }
    }
  }

  const insuranceEnrich = await enrichPatientsAfterScheduleSync({
    practiceId,
    patientIds: touchedPatientIds,
    preferInline: force,
  })

  const syncMetadata = {
    syncDays: options.businessDays ?? configSyncDays,
    businessDays: options.businessDays ?? configSyncDays,
    startDate: options.startDate ?? null,
    endDate: options.endDate ?? null,
    daysQueried: days.length,
    practitionerRefs,
    synced,
    created,
    updated,
    skipped,
    dayErrors,
    touchedPatientCount: touchedPatientIds.size,
    insuranceEnrich,
  }

  await logEhrAudit({
    tenantId: practiceId,
    actorUserId: null,
    action: 'EHR_APPOINTMENT_SYNC_COMPLETE',
    providerId: WRITEBACK_PROVIDER_ID,
    entity: 'Encounter',
    metadata: syncMetadata,
  })

  return {
    status: 'success' as const,
    ...syncMetadata,
  }
}

export async function syncEhrAppointmentsAcrossPractices() {
  const connections = await prisma.ehrConnection.findMany({
    where: {
      providerId: WRITEBACK_PROVIDER_ID,
      authFlow: 'backend_services',
      status: 'connected',
      accessTokenEnc: { not: null },
    },
    select: {
      tenantId: true,
    },
  })

  const practiceIds = Array.from(new Set(connections.map((connection) => connection.tenantId)))
  const results: Array<{ practiceId: string; status: string; details?: unknown }> = []

  for (const practiceId of practiceIds) {
    try {
      const result = await syncEhrAppointmentsForPractice(practiceId)
      results.push({ practiceId, status: result.status, details: result })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      results.push({ practiceId, status: 'error', details: { error: message } })
    }
  }

  return { totalPractices: practiceIds.length, results }
}

export async function listEhrPractitionersForPractice(practiceId: string): Promise<EhrPractitionerOption[]> {
  const ehrContext = await createEhrClientForPractice(practiceId, { timeoutMs: ECW_SYNC_TIMEOUT_MS })
  if (!ehrContext) {
    return []
  }

  const { client, connection } = ehrContext
  const settings = await getEhrSettings(practiceId)
  const writeConfig =
    (settings?.providerConfigs?.[WRITEBACK_PROVIDER_ID] as Record<string, unknown> | undefined) || {}
  const scheduling = await getSchedulingSettings(practiceId)

  const targetRefs = await resolveEcwPractitionerRefsForPractice(practiceId, {
    scheduling,
    client,
    issuer: connection.issuer,
    writeConfig,
  })

  const options: EhrPractitionerOption[] = []
  for (const reference of targetRefs) {
    const practitionerId = reference.replace(/^Practitioner\//, '')
    let name = `Practitioner ${practitionerId.slice(0, 8)}`
    try {
      const practitioner = await fetchPractitionerByIdSearch(client, practitionerId)
      if (practitioner?.id) {
        name = formatPractitionerName(practitioner) || name
      }
    } catch {
      // Keep fallback label when a single configured ref cannot be resolved.
    }
    options.push({
      id: practitionerId,
      reference,
      name,
    })
  }

  const deduped = new Map<string, EhrPractitionerOption>()
  for (const option of options) {
    if (!deduped.has(option.reference)) {
      deduped.set(option.reference, option)
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export type EcwScheduledEncounter = FhirEncounter & {
  schedulePractitionerRef: string
}

/** Pull Encounter rows from eCW for one or more practitioners across an inclusive calendar date range. */
export async function fetchEcwEncountersForSchedule(params: {
  practiceId: string
  /** @deprecated Prefer practitionerRefs */
  practitionerRef?: string
  practitionerRefs?: string[]
  dateStart: string
  dateEnd: string
}) {
  let practitionerRefs = (params.practitionerRefs ?? [])
    .map((value) => normalizePractitionerReference(value.trim()))
    .filter((value): value is string => Boolean(value))

  if (practitionerRefs.length === 0 && params.practitionerRef) {
    const single = normalizePractitionerReference(params.practitionerRef.trim())
    if (single) practitionerRefs = [single]
  }

  if (practitionerRefs.length === 0) {
    practitionerRefs = await resolveEcwSchedulePractitionerRefs(params.practiceId)
  }

  if (practitionerRefs.length === 0) {
    throw new Error('No eClinicalWorks practitioners available for schedule lookup')
  }

  const ehrContext = await createEhrClientForPractice(params.practiceId)
  if (!ehrContext) {
    throw new Error('eClinicalWorks backend connection is not configured for this practice')
  }

  const days = getCalendarDaysInRange(params.dateStart, params.dateEnd, SYNC_TIMEZONE)
  if (days.length === 0) {
    throw new Error('Invalid date range')
  }

  const { client } = ehrContext
  const encounteredIds = new Set<string>()
  const encounters: EcwScheduledEncounter[] = []

  for (const practitionerRef of practitionerRefs) {
    for (const day of days) {
      const query = buildEncounterScheduleQuery(practitionerRef, day)
      const batch = await fetchEncounterPages(client, query)
      for (const encounter of batch) {
        if (!encounter.id || encounteredIds.has(encounter.id)) continue
        encounteredIds.add(encounter.id)
        encounters.push({ ...encounter, schedulePractitionerRef: practitionerRef })
      }
    }
  }

  return encounters
}
