import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import {
  getEhrSettings,
  getPrivateKeyJwtConfig,
  getEcwClientAssertionAud,
} from '@/lib/integrations/ehr/server'
import { createClientAssertion } from '@/lib/integrations/ehr/smartEngine'
import { createDraftDocumentReference } from '@/lib/integrations/fhir/resources/documentReference'
import { createPatient } from '@/lib/integrations/fhir/resources/patient'
import { FhirClient, WriteNotSupportedError } from '@/lib/integrations/fhir/fhirClient'
import type { ExtractedCallData } from '@/lib/process-call-data'
import type { EhrSettings } from '@/lib/integrations/ehr/types'
import type { RetellCall } from '@/lib/retell-api'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'

const WRITEBACK_PROVIDER_ID = 'ecw_write'
const ECW_PATIENT_IDENTIFIER_SYSTEM = 'urn:oid:2.16.840.1.113883.4.391.326070'
const ECW_PATIENT_IDENTIFIER_VALUE = '15455'

/** Defaults preserve legacy behavior when fields are unset. */
export function getRetellEcwWritebackLayerFlags(settings: EhrSettings | null) {
  return {
    allowPatientCreate: settings?.ehrRetellWritebackAllowPatientCreate !== false,
    allowEncounter: settings?.ehrRetellWritebackAllowTelephoneEncounter !== false,
    allowDraftNotes: settings?.ehrRetellWritebackAllowDraftNotes !== false,
  }
}

export type EcwTelephoneEncounterRefs = {
  participantPractitionerRef: string
  /** Resolved for logging/metadata; included on the Encounter only when `buildTelephoneEncounterBundle({ includeTelephoneAssignedTo: true })`. */
  assignedToPractitionerRef?: string
  locationRef: string
  organizationRef?: string
}

export type EcwTelephoneIssuerBucket = 'facgcd' | 'ffbjcd' | 'ffbjcd_fallback'

export function telephoneDefaultBucketFromIssuer(issuer: string | null | undefined): EcwTelephoneIssuerBucket {
  const n = (issuer || '').toLowerCase()
  if (n.includes('/facgcd')) return 'facgcd'
  if (n.includes('/ffbjcd')) return 'ffbjcd'
  return 'ffbjcd_fallback'
}

/** Align Retell / note-sync bundles with minimal direct-to-eCW payloads (no assignedTo; notes identical to messages). */
export const TELEPHONE_ENCOUNTER_BUNDLE_DIRECT_ECW_OPTIONS = {
  includeTelephoneAssignedTo: false,
  notesAttribution: 'none' as const,
} as const

const ECW_TELEPHONE_REFS_FFBJCD: EcwTelephoneEncounterRefs & { assignedToPractitionerRef: string } = {
  participantPractitionerRef: 'Practitioner/Lt2IFR5Ah76n4d8TFP5gBPiX1g1-Q2P9s8IYoGZvbFM',
  assignedToPractitionerRef: 'Practitioner/Lt2IFR5Ah76n4d8TFP5gBAfrwqxiesg83cejztPkOEI',
  locationRef: 'Location/Lt2IFR5Ah76n4d8TFP5gBFO4aIYpuamqju2XjvYx6Ik',
  organizationRef: 'Organization/Lt2IFR5Ah76n4d8TFP5gBPMFWGL8HhxnxooU.mnA.n5.Xl5yXZN1TQgZByeKFIIZ',
}

const ECW_TELEPHONE_REFS_FACGCD: EcwTelephoneEncounterRefs & { assignedToPractitionerRef: string } = {
  participantPractitionerRef: 'Practitioner/W6s8TGka96L4tHbCRoQU8YMH.WUkwA2pU9wsHWwur0c',
  assignedToPractitionerRef: 'Practitioner/W6s8TGka96L4tHbCRoQU8YMH.WUkwA2pU9wsHWwur0c',
  locationRef: 'Location/W6s8TGka96L4tHbCRoQU8V1DmHBjAJrx9h-SsrKuRnA',
  organizationRef: 'Organization/W6s8TGka96L4tHbCRoQU8ZfnvLnRYQ9519x5HFoW2uFnSuQOQi-FoYA2O2oMawcO',
}

/** Location + org from bundled telephone-encounter defaults (when PractitionerRole does not return them). */
export function getEcwDefaultLocationOrganizationForIssuer(issuer: string): {
  locationRef: string
  organizationRef: string
} | null {
  const n = issuer.toLowerCase()
  if (n.includes('/facgcd')) {
    return {
      locationRef: ECW_TELEPHONE_REFS_FACGCD.locationRef,
      organizationRef: ECW_TELEPHONE_REFS_FACGCD.organizationRef!,
    }
  }
  if (n.includes('/ffbjcd')) {
    return {
      locationRef: ECW_TELEPHONE_REFS_FFBJCD.locationRef,
      organizationRef: ECW_TELEPHONE_REFS_FFBJCD.organizationRef!,
    }
  }
  return null
}

const ENCOUNTER_NOTE_TYPES = [
  'telephone_encounter',
  'online_visit',
  'onsite_visit',
] as const

type WritebackResult = {
  status: 'skipped' | 'success' | 'error'
  reason?: string
  noteId?: string
  reviewUrl?: string
}

export function isSuccessfulTransactionStatus(status: string | number | undefined): boolean {
  if (status === undefined || status === null) return false
  const normalized = String(status).trim()
  // eCW transaction responses can return "1" for success instead of HTTP-like 2xx.
  return normalized === '1' || normalized.startsWith('2')
}

/** eCW Bundle `$transaction` entry `response.status` when practitioner refs are invalid for org/location. */
const ECW_TRANSACTION_STATUS_WRONG_PRACTITIONER = '101'

function ecwTransactionFailureHint(status: string | number | undefined): string {
  if (String(status ?? '').trim() === ECW_TRANSACTION_STATUS_WRONG_PRACTITIONER) {
    return ' — eCW: wrong practitioner information (verify telephone encounter practitioner refs vs org/location).'
  }
  return ''
}

export function extractResourceIdFromLocation(
  location: string | undefined,
  resourceType: 'Patient' | 'Encounter' | 'DocumentReference'
): string | undefined {
  if (!location) return undefined
  const marker = `/${resourceType}/`
  const markerIndex = location.indexOf(marker)
  if (markerIndex >= 0) {
    const remainder = location.slice(markerIndex + marker.length)
    const id = remainder.split('/')[0]
    return id || undefined
  }
  const trimmed = location.replace(/^\/+/, '')
  const segments = trimmed.split('/').filter(Boolean)
  const typeIndex = segments.findIndex((segment) => segment === resourceType)
  if (typeIndex >= 0 && segments[typeIndex + 1]) {
    return segments[typeIndex + 1]
  }
  return undefined
}

function parsePatientName(fullName: string | null | undefined): {
  given: string[]
  family?: string
  text?: string
} | null {
  if (!fullName) return null
  const cleaned = fullName.trim()
  if (!cleaned) return null
  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) {
    return { given: [parts[0]], text: cleaned }
  }
  const family = parts[parts.length - 1]
  const given = parts.slice(0, -1)
  return { given, family, text: cleaned }
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}\n\n[Truncated]`
}

function formatEcwPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return value
}

function formatEhrTimestamp(date: Date, timeZone?: string | null): string {
  try {
    const resolvedTimeZone = timeZone && timeZone.trim() ? timeZone.trim() : 'UTC'
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: resolvedTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'shortOffset',
    })
    const parts = formatter.formatToParts(date)
    const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
    const offsetRaw = get('timeZoneName') || 'GMT'
    const offsetMatch = offsetRaw.match(/GMT([+-]\d{1,2})/)
    const offsetHours = offsetMatch ? Number(offsetMatch[1]) : 0
    const offset = `${offsetHours >= 0 ? '+' : '-'}${String(Math.abs(offsetHours)).padStart(2, '0')}:00`
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00${offset}`
  } catch {
    return date.toISOString()
  }
}

function parseBooleanLike(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return null
  if (['true', 'yes', 'y', '1'].includes(normalized)) return true
  if (['false', 'no', 'n', '0'].includes(normalized)) return false
  return null
}

function normalizeFhirReference(value: unknown, resourceType: 'Practitioner' | 'Location' | 'Organization') {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith(`${resourceType}/`)) return trimmed
  if (trimmed.includes('/')) return null
  return `${resourceType}/${trimmed}`
}

/** Practitioner + location/org used on telephone Encounter; eCW returns transaction status 101 if practitioner info does not match site rules. */
export function resolveEcwTelephoneEncounterRefs(
  settings: Awaited<ReturnType<typeof getEhrSettings>>,
  issuer?: string | null
): EcwTelephoneEncounterRefs {
  const bucket = telephoneDefaultBucketFromIssuer(issuer)
  const normalizedIssuer = (issuer || '').toLowerCase()
  const defaults =
    bucket === 'facgcd'
      ? ECW_TELEPHONE_REFS_FACGCD
      : bucket === 'ffbjcd'
        ? ECW_TELEPHONE_REFS_FFBJCD
        : ECW_TELEPHONE_REFS_FFBJCD
  const writeConfig =
    (settings?.providerConfigs?.[WRITEBACK_PROVIDER_ID] as Record<string, unknown> | undefined) || {}
  const primaryPractitionerRef = normalizeFhirReference(
    writeConfig.ecwTelephonePractitionerRef,
    'Practitioner'
  )
  const participantPractitionerRef =
    primaryPractitionerRef ||
    normalizeFhirReference(writeConfig.ecwTelephoneParticipantPractitionerRef, 'Practitioner') ||
    defaults.participantPractitionerRef
  const explicitAssignedTo = normalizeFhirReference(
    writeConfig.ecwTelephoneAssignedToPractitionerRef,
    'Practitioner'
  )
  const assignedToPractitionerRef =
    explicitAssignedTo ||
    primaryPractitionerRef ||
    participantPractitionerRef ||
    defaults.assignedToPractitionerRef

  if (bucket === 'ffbjcd_fallback' && normalizedIssuer && !normalizedIssuer.includes('localhost')) {
    console.warn('[EHR Writeback] Issuer URL does not contain /facgcd or /ffbjcd; using FFBJCD telephone encounter defaults', {
      issuerSample: issuer?.slice(0, 80),
      bucket,
    })
  }

  return {
    participantPractitionerRef,
    assignedToPractitionerRef,
    locationRef:
      normalizeFhirReference(writeConfig.ecwTelephoneLocationRef, 'Location') || defaults.locationRef,
    organizationRef:
      normalizeFhirReference(writeConfig.ecwTelephoneOrganizationRef, 'Organization') ||
      defaults.organizationRef,
  }
}

function missingEncounterRefs(refs: EcwTelephoneEncounterRefs) {
  const missing: string[] = []
  if (!refs.participantPractitionerRef?.trim()) missing.push('participantPractitionerRef')
  if (!refs.assignedToPractitionerRef?.trim()) missing.push('assignedToPractitionerRef')
  if (!refs.locationRef?.trim()) missing.push('locationRef')
  return missing
}

/** Strip optional Patient/ prefix and history segments for Encounter.subject reference. */
export function normalizeStoredEhrPatientId(stored: string) {
  let s = stored.trim()
  if (s.startsWith('Patient/')) s = s.slice('Patient/'.length)
  return s.split('/')[0] || s
}

export function encounterAndNotesAllowedForPatientMode(
  settings: EhrSettings | null,
  patientMode: 'new' | 'existing' | 'check_only' | 'conflict'
): boolean {
  if (patientMode === 'new') {
    return settings?.ehrRetellWritebackEncounterAndNotesWhenNewPatient !== false
  }
  if (patientMode === 'existing') {
    return settings?.ehrRetellWritebackEncounterAndNotesWhenExistingPatient !== false
  }
  return true
}

function resolvePatientMode(params: {
  extractedData: ExtractedCallData
}): 'new' | 'existing' | 'check_only' | 'conflict' {
  const customData = (params.extractedData.retell_custom_data || {}) as Record<string, unknown>
  const newPatientAdd = parseBooleanLike(
    customData['New Patient Add'] ?? customData['new patient add'] ?? params.extractedData.new_patient_add
  )
  const existingPatientUpdate = parseBooleanLike(
    customData['Existing Patient Update'] ??
      customData['existing patient update'] ??
      params.extractedData.existing_patient_update
  )
  if (existingPatientUpdate === true && newPatientAdd === true) return 'conflict'
  if (existingPatientUpdate === true) return 'existing'
  if (newPatientAdd === true) return 'new'
  // Strict mode: if booleans are not true, only perform demographic checks.
  return 'check_only'
}

function parseDobToIso(dateText: string | undefined) {
  if (!dateText) return null
  const raw = dateText.trim()
  const mdy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (mdy) {
    const month = Number(mdy[1])
    const day = Number(mdy[2])
    const year = Number(mdy[3])
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
      .toString()
      .padStart(2, '0')}`
  }

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const day = Number(iso[3])
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
      .toString()
      .padStart(2, '0')}`
  }

  // Retell often provides natural-language DOB (e.g. "April 12, 1986").
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  const year = parsed.getUTCFullYear()
  const month = parsed.getUTCMonth() + 1
  const day = parsed.getUTCDate()
  if (year <= 1900) return null
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`
}

async function findEhrPatientId(params: {
  client: FhirClient
  fullName?: string | null
  birthDate?: string | null
  phone?: string | null
}) {
  const { client, fullName, birthDate, phone } = params
  const name = fullName?.trim() || ''
  const normalizedPhone = phone ? phone.replace(/\D/g, '') : ''
  if (!name && !normalizedPhone) return null

  const queries: string[] = []
  if (name && birthDate) {
    queries.push(`/Patient?name=${encodeURIComponent(name)}&birthdate=${encodeURIComponent(birthDate)}`)
    const parts = name.split(/\s+/)
    if (parts.length >= 2) {
      const family = parts[parts.length - 1]
      const given = parts.slice(0, -1).join(' ')
      queries.push(
        `/Patient?family=${encodeURIComponent(family)}&given=${encodeURIComponent(
          given
        )}&birthdate=${encodeURIComponent(birthDate)}`
      )
    }
  }
  if (normalizedPhone && birthDate) {
    queries.push(
      `/Patient?phone=${encodeURIComponent(normalizedPhone)}&birthdate=${encodeURIComponent(birthDate)}`
    )
  }
  if (name && normalizedPhone) {
    queries.push(`/Patient?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(normalizedPhone)}`)
  }
  if (queries.length === 0 && name) {
    queries.push(`/Patient?name=${encodeURIComponent(name)}`)
  }

  for (const query of queries) {
    try {
      const result = (await client.request(query)) as any
      const entry = Array.isArray(result?.entry) ? result.entry[0] : null
      const id = entry?.resource?.id as string | undefined
      if (id) {
        return id
      }
    } catch (error) {
      console.warn('[EHR Writeback] Patient lookup failed', { query })
    }
  }

  return null
}

function buildCallNoteText(call: RetellCall, extractedData: ExtractedCallData): string {
  const lines: string[] = []
  lines.push('Vantage AI call summary (draft)')
  if (call.call_id) lines.push(`Call ID: ${call.call_id}`)
  if (extractedData.call_reason) lines.push(`Call reason: ${extractedData.call_reason}`)
  if (extractedData.call_summary) lines.push(`Summary: ${extractedData.call_summary}`)
  const detailed = extractedData.detailed_call_summary || call.call_analysis?.call_summary
  if (detailed && detailed !== extractedData.call_summary) {
    lines.push(`Details: ${detailed}`)
  }
  if (extractedData.selected_date || extractedData.selected_time) {
    lines.push(
      `Requested time: ${[extractedData.selected_date, extractedData.selected_time]
        .filter(Boolean)
        .join(' ')}`
    )
  }
  if (extractedData.preferred_dentist) {
    lines.push(`Preferred provider: ${extractedData.preferred_dentist}`)
  }
  if (extractedData.insurance_verification) {
    lines.push('Insurance verification captured: yes')
  }
  if (call.transcript) {
    lines.push('')
    lines.push('Transcript (truncated):')
    lines.push(truncateText(call.transcript, 4000))
  }
  return lines.filter(Boolean).join('\n')
}

function buildTelephoneEncounterNoteText(
  call: RetellCall,
  extractedData: ExtractedCallData
): string {
  const detailed = extractedData.detailed_call_summary || call.call_analysis?.call_summary
  const summary = extractedData.call_summary || call.call_analysis?.call_summary
  const fallback = (detailed || summary || buildCallNoteText(call, extractedData)).trim()
  // eCW is more reliable when encounter extension text stays concise.
  return truncateText(fallback || 'Telephone encounter note', 1800)
}

export function buildTelephoneEncounterBundle(params: {
  patientId: string
  noteText: string
  startTime: Date
  endTime: Date
  refs: EcwTelephoneEncounterRefs
  timeZone?: string
  encounterId?: string
  requestMethod?: 'POST' | 'PUT'
  encounterClass?: { code: string; display: string }
  encounterStatus?: string
  subjectDisplay?: string
  /**
   * When false, omit `telephoneEncounter/assignedTo` (matches minimal direct-to-eCW payloads eCW accepts for FACGCD).
   * @default true
   */
  includeTelephoneAssignedTo?: boolean
  /**
   * `vantage`: append attribution line to `notes` extension only.
   * `none`: same string as `messages` for `notes` (matches direct Postman/eCW tooling).
   * @default 'vantage'
   */
  notesAttribution?: 'vantage' | 'none'
}) {
  const ecwMaxMessageLength = 2000
  const ecwMaxNotesLength = 2000
  const bundleId = randomUUID()
  const requestMethod = params.requestMethod || 'POST'
  const encounterId = requestMethod === 'PUT' ? params.encounterId || randomUUID() : undefined
  const requestUrl = requestMethod === 'PUT' ? `Encounter/${encounterId}` : 'Encounter'
  const includeAssignedTo = params.includeTelephoneAssignedTo !== false
  const notesAttribution = params.notesAttribution ?? 'vantage'
  const attribution = `This encounter is created by VantageAI app at ${formatEhrTimestamp(
    params.startTime,
    params.timeZone
  )}`
  const normalizedNoteText = params.noteText.trim()
  const baseText = normalizedNoteText || 'Telephone encounter note'
  const messageText = truncateText(baseText, ecwMaxMessageLength)
  const notesText =
    notesAttribution === 'none'
      ? messageText
      : truncateText(`${baseText}\n${attribution}`, ecwMaxNotesLength)
  const classBlock = params.encounterClass
    ? {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: params.encounterClass.code,
        display: params.encounterClass.display,
      }
    : {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'VR',
        display: 'virtual',
      }
  const telephoneExtensions: Array<Record<string, unknown>> = [
    {
      url: 'http://eclinicalworks.com/supportingInfo/telephoneEncounter/messages',
      valueString: messageText,
    },
    {
      url: 'http://eclinicalworks.com/supportingInfo/telephoneEncounter/notes',
      valueString: notesText,
    },
  ]
  const assignedToRef = params.refs.assignedToPractitionerRef?.trim()
  if (includeAssignedTo && assignedToRef) {
    telephoneExtensions.push({
      url: 'http://eclinicalworks.com/supportingInfo/telephoneEncounter/assignedTo',
      valueReference: { reference: assignedToRef },
    })
  }
  const subject: { reference: string; display?: string } = {
    reference: `Patient/${params.patientId}`,
  }
  if (params.subjectDisplay?.trim()) {
    subject.display = params.subjectDisplay.trim()
  }
  return {
    resourceType: 'Bundle',
    id: bundleId,
    meta: { lastUpdated: formatEhrTimestamp(new Date(), params.timeZone) },
    type: 'transaction',
    entry: [
      {
        resource: {
          resourceType: 'Encounter',
          ...(requestMethod === 'PUT' && encounterId ? { id: encounterId } : {}),
          meta: {
            lastUpdated: formatEhrTimestamp(new Date(), params.timeZone),
            profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter'],
          },
          extension: telephoneExtensions,
          status: params.encounterStatus?.trim() || 'arrived',
          class: classBlock,
          type: [
            {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: '185317003',
                  display: 'Telephonic Encounter',
                },
              ],
              text: 'Telephonic Encounter',
            },
          ],
          subject,
          participant: [
            {
              individual: { reference: params.refs.participantPractitionerRef, type: 'Practitioner' },
            },
          ],
          period: {
            start: formatEhrTimestamp(params.startTime, params.timeZone),
            end: formatEhrTimestamp(params.endTime, params.timeZone),
          },
          reasonCode: [{ text: 'Telephone encounter' }],
          location: [
            {
              location: { reference: params.refs.locationRef, type: 'Location' },
            },
          ],
          serviceProvider: params.refs.organizationRef
            ? { reference: params.refs.organizationRef, type: 'Organization' }
            : undefined,
        },
        request: { method: requestMethod, url: requestUrl },
      },
    ],
  }
}

function formatEncounterNote(type: string, content: string) {
  const label =
    type === 'telephone_encounter'
      ? 'Telephone Encounter Notes'
      : type === 'online_visit'
        ? 'Online Visit Notes'
        : type === 'onsite_visit'
          ? 'Onsite Visit Notes'
          : 'Note'
  return `${label}\n\n${content}`
}

function isPlaceholderDob(date: Date | null | undefined) {
  if (!date) return true
  return date.toISOString().startsWith('1900-01-01')
}

async function markConversationMetadata(
  practiceId: string,
  callId: string,
  updates: Record<string, unknown>
) {
  const conversation = await prisma.voiceConversation.findFirst({
    where: { practiceId, retellCallId: callId },
  })
  if (!conversation) return null
  const existingMetadata =
    conversation.metadata && typeof conversation.metadata === 'object'
      ? (conversation.metadata as Record<string, unknown>)
      : {}
  return prisma.voiceConversation.update({
    where: { id: conversation.id },
    data: {
      metadata: {
        ...existingMetadata,
        ...updates,
      } as Prisma.InputJsonObject,
    },
  })
}

export async function writeBackRetellCallToEhr(params: {
  practiceId: string
  patientId: string | null
  call: RetellCall
  extractedData: ExtractedCallData
}): Promise<WritebackResult> {
  const { practiceId, patientId, call, extractedData } = params
  const WRITEBACK_VERSION = 'writeback_v18'
  if (!call.call_id) {
    return { status: 'skipped', reason: 'missing_call_id' }
  }

  const settings = await getEhrSettings(practiceId)
  const layers = getRetellEcwWritebackLayerFlags(settings)
  const patientMode = resolvePatientMode({ extractedData })
  const encounterNotesByModeForLog = encounterAndNotesAllowedForPatientMode(settings, patientMode)

  console.log('[EHR Writeback] Start', {
    practiceId,
    callId: call.call_id,
    patientId,
    hasExtractedName: Boolean(extractedData.patient_name),
    hasExtractedPhone: Boolean(extractedData.user_phone_number),
    writebackVersion: WRITEBACK_VERSION,
    retellWritebackLayers: layers,
    patientMode,
    encounterAndNotesForPatientMode: encounterNotesByModeForLog,
  })

  const existingConversation = await prisma.voiceConversation.findFirst({
    where: { practiceId, retellCallId: call.call_id },
  })
  const existingMetadata =
    existingConversation?.metadata && typeof existingConversation.metadata === 'object'
      ? (existingConversation.metadata as Record<string, unknown>)
      : {}
  const existingWritebackStatus = existingMetadata.ehrWritebackStatus
  if (existingWritebackStatus === 'success') {
    return { status: 'skipped', reason: 'already_written' }
  }
  if (existingWritebackStatus === 'in_progress') {
    const startedAtRaw = existingMetadata.ehrWritebackStartedAt
    const startedAtMs =
      typeof startedAtRaw === 'string' && startedAtRaw
        ? new Date(startedAtRaw).getTime()
        : Number.NaN
    if (Number.isNaN(startedAtMs) || Date.now() - startedAtMs < 30 * 60 * 1000) {
      return { status: 'skipped', reason: 'duplicate_in_progress' }
    }
  }

  if (settings?.ehrWritebackOnNewPatientAdd === false && patientMode === 'new') {
    await markConversationMetadata(practiceId, call.call_id, {
      ehrWritebackStatus: 'skipped',
      ehrWritebackError:
        'EHR writeback disabled for calls classified as New Patient Add (practice setting).',
      ehrWritebackFailedAt: new Date().toISOString(),
      ehrWritebackVersion: WRITEBACK_VERSION,
    })
    return { status: 'skipped', reason: 'retell_writeback_disabled_new_patient_add' }
  }
  if (settings?.ehrWritebackOnExistingPatientUpdate === false && patientMode === 'existing') {
    await markConversationMetadata(practiceId, call.call_id, {
      ehrWritebackStatus: 'skipped',
      ehrWritebackError:
        'EHR writeback disabled for calls classified as Existing Patient Update (practice setting).',
      ehrWritebackFailedAt: new Date().toISOString(),
      ehrWritebackVersion: WRITEBACK_VERSION,
    })
    return { status: 'skipped', reason: 'retell_writeback_disabled_existing_patient_update' }
  }
  if (!layers.allowPatientCreate && !layers.allowEncounter && !layers.allowDraftNotes) {
    await markConversationMetadata(practiceId, call.call_id, {
      ehrWritebackStatus: 'skipped',
      ehrWritebackError:
        'All Retell eCW writeback layers are disabled (patient create, telephone encounter, draft notes).',
      ehrWritebackFailedAt: new Date().toISOString(),
      ehrWritebackVersion: WRITEBACK_VERSION,
    })
    return { status: 'skipped', reason: 'retell_writeback_all_layers_disabled' }
  }

  await markConversationMetadata(practiceId, call.call_id, {
    ehrWritebackStatus: 'in_progress',
    ehrWritebackStartedAt: new Date().toISOString(),
    ehrWritebackProviderId: WRITEBACK_PROVIDER_ID,
    ehrWritebackVersion: WRITEBACK_VERSION,
  })

  try {
    const connections = await prisma.ehrConnection.findMany({
      where: {
        tenantId: practiceId,
        providerId: WRITEBACK_PROVIDER_ID,
        authFlow: 'backend_services',
        status: 'connected',
      },
      orderBy: { updatedAt: 'desc' },
    })
    const connection = connections[0]
    if (!connection?.accessTokenEnc) {
      console.error('[EHR Writeback] Missing backend connection', {
        practiceId,
        callId: call.call_id,
        providerId: WRITEBACK_PROVIDER_ID,
        writebackVersion: WRITEBACK_VERSION,
      })
      await markConversationMetadata(practiceId, call.call_id, {
        ehrWritebackStatus: 'error',
        ehrWritebackError: 'No backend services connection for writeback provider.',
        ehrWritebackFailedAt: new Date().toISOString(),
        ehrWritebackVersion: WRITEBACK_VERSION,
      })
      return { status: 'error', reason: 'missing_connection' }
    }

    const refreshedConnection = await refreshBackendConnectionIfNeeded({ connection })
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
        accessToken: decryptString(refreshedConnection.accessTokenEnc!),
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
        await logEhrAudit({
          tenantId: practiceId,
          actorUserId: null,
          action: 'EHR_TOKEN_REFRESH',
          providerId: connection.providerId,
          entity: 'EhrConnection',
          entityId: connection.id,
        })
      },
      timeoutMs: 120_000,
    })

    let capabilityStatement
    try {
      capabilityStatement = await client.getCapabilityStatement()
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('Token refresh failed') || message.includes('FHIR request failed: 401')) {
        await prisma.ehrConnection.update({
          where: { id: connection.id },
          data: { status: 'expired' },
        })
        await logEhrAudit({
          tenantId: practiceId,
          actorUserId: null,
          action: 'EHR_TOKEN_EXPIRED',
          providerId: connection.providerId,
          entity: 'EhrConnection',
          entityId: connection.id,
        })
        await markConversationMetadata(practiceId, call.call_id, {
          ehrWritebackStatus: 'error',
          ehrWritebackError: 'EHR token expired',
          ehrWritebackFailedAt: new Date().toISOString(),
        })
        return { status: 'error', reason: 'token_expired' }
      }
      throw error
    }

    let ehrPatientId: string | null = null
    let ehrPatientCreatedInEcw = false
    let patientRecord = null
    if (patientId) {
      patientRecord = await prisma.patient.findUnique({
        where: { id: patientId },
      })
      ehrPatientId = patientRecord?.externalEhrId || null
    }

    const lookupBirthDate =
      parseDobToIso(extractedData.patient_dob) ||
      (patientRecord?.dateOfBirth
        ? patientRecord.dateOfBirth.toISOString().split('T')[0]
        : null)
    const lookupName = patientRecord?.name || extractedData.patient_name || null
    // Prefer patient-stated number from this call before CRM/store, then PSTN/callback last.
    const lookupPhone =
      extractedData.patient_phone_number ||
      patientRecord?.primaryPhone ||
      patientRecord?.phone ||
      extractedData.user_phone_number ||
      null

    if (!ehrPatientId && (lookupName || lookupPhone)) {
      const matchedId = await findEhrPatientId({
        client,
        fullName: lookupName,
        birthDate: lookupBirthDate,
        phone: lookupPhone,
      })
      if (matchedId) {
        ehrPatientId = matchedId
        if (patientRecord && patientRecord.externalEhrId !== matchedId) {
          await prisma.patient.update({
            where: { id: patientRecord.id },
            data: { externalEhrId: matchedId },
          })
        }
      }
    }

    if (patientMode === 'conflict') {
      console.warn('[EHR Writeback] Conflicting patient profile flags', {
        practiceId,
        callId: call.call_id,
        patientId,
      })
      await markConversationMetadata(practiceId, call.call_id, {
        ehrWritebackStatus: 'error',
        ehrWritebackError: 'Conflicting profile flags: both new patient add and existing patient update are true.',
        ehrWritebackFailedAt: new Date().toISOString(),
      })
      return { status: 'error', reason: 'conflicting_patient_flags' }
    }

    if (!ehrPatientId && patientMode === 'existing') {
      console.warn('[EHR Writeback] Existing patient missing EHR match', {
        practiceId,
        callId: call.call_id,
        patientId,
      })
      return { status: 'error', reason: 'missing_patient_id' }
    }

    if (!ehrPatientId && patientMode === 'check_only') {
      console.warn('[EHR Writeback] No EHR match and creation not requested', {
        practiceId,
        callId: call.call_id,
        patientId,
      })
      await markConversationMetadata(practiceId, call.call_id, {
        ehrWritebackStatus: 'skipped',
        ehrWritebackError:
          'No matching EHR patient found and profile create/update was not requested by extracted booleans.',
        ehrWritebackFailedAt: new Date().toISOString(),
      })
      return { status: 'skipped', reason: 'create_not_requested' }
    }

    if (
      !ehrPatientId &&
      layers.allowPatientCreate &&
      settings?.enablePatientCreate &&
      patientRecord &&
      patientMode === 'new'
    ) {
        const name =
          parsePatientName(patientRecord.name) || parsePatientName(extractedData.patient_name)
      if (name) {
        const telecom: Array<{ system: 'phone' | 'email'; value: string; use?: string }> = []
        const phone = patientRecord.primaryPhone || patientRecord.phone
        if (phone) {
          telecom.push({
            system: 'phone',
            value: connection.providerId.startsWith('ecw') ? formatEcwPhone(phone) : phone,
            use: connection.providerId.startsWith('ecw') ? 'home' : 'mobile',
          })
        }
        if (patientRecord.email) telecom.push({ system: 'email', value: patientRecord.email })
        const extractedBirthDate = parseDobToIso(extractedData.patient_dob)
        const birthDate =
          !isPlaceholderDob(patientRecord.dateOfBirth) && patientRecord.dateOfBirth
            ? patientRecord.dateOfBirth.toISOString().split('T')[0]
            : extractedBirthDate || undefined
          if (connection.providerId.startsWith('ecw') && name.text) {
            name.text = undefined
          }
        const created = await createPatient(
          client,
          {
            name,
            telecom: telecom.length ? telecom : undefined,
            gender: patientRecord.gender || 'unknown',
            birthDate,
            identifiers: connection.providerId.startsWith('ecw')
              ? [
                  {
                    system: ECW_PATIENT_IDENTIFIER_SYSTEM,
                    value: ECW_PATIENT_IDENTIFIER_VALUE,
                  },
                ]
              : undefined,
          },
          capabilityStatement,
          { skipCapabilityCheck: connection.providerId.startsWith('ecw') }
        )
        const responseStatus = (created as any)?.entry?.[0]?.response?.status as string | undefined
        const responseLocation = (created as any)?.entry?.[0]?.response?.location as string | undefined
        console.log('[EHR Writeback] Patient create response', {
          practiceId,
          callId: call.call_id,
          status: responseStatus,
          location: responseLocation,
        })
        const location = (created as any)?.entry?.[0]?.response?.location as string | undefined
        const createdId = extractResourceIdFromLocation(location, 'Patient')
        if (!createdId) {
          console.error('[EHR Writeback] Missing created patient id', {
            practiceId,
            callId: call.call_id,
            location,
          })
          await markConversationMetadata(practiceId, call.call_id, {
            ehrWritebackStatus: 'error',
            ehrWritebackError: 'Missing created EHR patient id.',
            ehrWritebackFailedAt: new Date().toISOString(),
          })
          return { status: 'error', reason: 'missing_created_id' }
        }
        if (createdId) {
          ehrPatientId = createdId
          ehrPatientCreatedInEcw = true
          await prisma.patient.update({
            where: { id: patientRecord.id },
            data: { externalEhrId: createdId },
          })
          await logEhrAudit({
            tenantId: practiceId,
            actorUserId: null,
            action: 'FHIR_WRITE',
            providerId: connection.providerId,
            entity: 'Patient',
            entityId: createdId,
            metadata: {
              patientId: patientRecord.id,
            },
          })
          // Brief pause after new patient creation before the encounter transaction
          // (eCW replication / readiness for chained writes in some tenants).
          await new Promise((r) => setTimeout(r, 3000))
        }
      }
    }

    const noteText = buildCallNoteText(call, extractedData)
    const encounterNoteText = buildTelephoneEncounterNoteText(call, extractedData)
    const encounterNotesByMode = encounterAndNotesAllowedForPatientMode(settings, patientMode)
    const wantsEncounter =
      layers.allowEncounter && Boolean(encounterNoteText?.trim()) && encounterNotesByMode
    const wantsNotes = layers.allowDraftNotes && encounterNotesByMode

    if (!ehrPatientId) {
      if (patientMode === 'new' && (wantsEncounter || wantsNotes) && !layers.allowPatientCreate) {
        await markConversationMetadata(practiceId, call.call_id, {
          ehrWritebackStatus: 'skipped',
          ehrWritebackError:
            'No EHR patient ID: telephone encounter and/or draft notes require an eCW patient, but creating a patient in eCW is disabled for Retell writeback.',
          ehrWritebackFailedAt: new Date().toISOString(),
          ehrWritebackVersion: WRITEBACK_VERSION,
          ehrWritebackLayersSummary: {
            patientCreateInEcw: false,
            patientMode,
            encounterNotesByMode,
            layersRequested: {
              patientCreate: layers.allowPatientCreate,
              encounter: layers.allowEncounter,
              draftNotes: layers.allowDraftNotes,
              encounterAndNotesWhenNewPatient:
                settings?.ehrRetellWritebackEncounterAndNotesWhenNewPatient !== false,
              encounterAndNotesWhenExistingPatient:
                settings?.ehrRetellWritebackEncounterAndNotesWhenExistingPatient !== false,
            },
          },
        })
        return { status: 'skipped', reason: 'missing_ehr_patient_patient_create_disabled' }
      }
      if (patientMode === 'new' && !wantsEncounter && !wantsNotes && !layers.allowPatientCreate) {
        await markConversationMetadata(practiceId, call.call_id, {
          ehrWritebackStatus: 'skipped',
          ehrWritebackError:
            'No EHR patient match and all Retell eCW writeback layers are off or not applicable without an existing eCW patient.',
          ehrWritebackFailedAt: new Date().toISOString(),
          ehrWritebackVersion: WRITEBACK_VERSION,
        })
        return { status: 'skipped', reason: 'retell_writeback_nothing_applicable' }
      }
      console.error('[EHR Writeback] Missing EHR patient ID', {
        practiceId,
        callId: call.call_id,
        writebackVersion: WRITEBACK_VERSION,
        patientId,
      })
      await markConversationMetadata(practiceId, call.call_id, {
        ehrWritebackStatus: 'error',
        ehrWritebackError: 'Missing EHR patient ID for writeback.',
        ehrWritebackFailedAt: new Date().toISOString(),
        ehrWritebackVersion: WRITEBACK_VERSION,
      })
      return { status: 'error', reason: 'missing_patient_id' }
    }

    const encounterNotePreview = encounterNoteText ? truncateText(encounterNoteText, 400) : ''
    const issuerTelephoneBucket = telephoneDefaultBucketFromIssuer(refreshedConnection.issuer)
    const ehrTimeZone = settings?.ehrTimeZone || undefined

    let encounterId: string | null = null
    let encounterUrl: string | null = null
    if (wantsEncounter) {
      const encounterRefs = resolveEcwTelephoneEncounterRefs(settings, refreshedConnection.issuer)
      console.log('[EHR Writeback] Telephone encounter ref resolution', {
        practiceId,
        callId: call.call_id,
        writebackVersion: WRITEBACK_VERSION,
        issuerTelephoneBucket,
        participantPractitionerRef: encounterRefs.participantPractitionerRef,
        assignedToPractitionerRef: encounterRefs.assignedToPractitionerRef,
        locationRef: encounterRefs.locationRef,
        organizationRef: encounterRefs.organizationRef,
        telephoneEncounterBundleShape: TELEPHONE_ENCOUNTER_BUNDLE_DIRECT_ECW_OPTIONS,
      })
      const missingRefs = missingEncounterRefs(encounterRefs)
      if (missingRefs.length > 0) {
        await markConversationMetadata(practiceId, call.call_id, {
          ehrWritebackStatus: 'error',
          ehrWritebackError: `Missing encounter reference configuration: ${missingRefs.join(', ')}`,
          ehrWritebackFailedAt: new Date().toISOString(),
          ehrWritebackVersion: WRITEBACK_VERSION,
        })
        return { status: 'error', reason: 'missing_encounter_refs' }
      }
      const startTime = call.start_timestamp ? new Date(call.start_timestamp) : new Date()
      const endTime = call.end_timestamp ? new Date(call.end_timestamp) : new Date(startTime.getTime() + 15 * 60 * 1000)
      const encounterBundle = buildTelephoneEncounterBundle({
        patientId: ehrPatientId,
        noteText: encounterNoteText,
        startTime,
        endTime,
        refs: encounterRefs,
        timeZone: ehrTimeZone,
        ...TELEPHONE_ENCOUNTER_BUNDLE_DIRECT_ECW_OPTIONS,
      })
      const encResource = encounterBundle.entry?.[0]?.resource as { extension?: Array<{ url?: string }> } | undefined
      const extUrls = encResource?.extension?.map((e) => e.url).filter(Boolean) ?? []
      await markConversationMetadata(practiceId, call.call_id, {
        ehrWritebackEncounterPayload: encounterBundle,
        ehrWritebackEncounterTimeZone: ehrTimeZone || null,
        ehrWritebackTelephoneIssuerBucket: issuerTelephoneBucket,
        ehrWritebackResolvedEncounterRefs: {
          participantPractitionerRef: encounterRefs.participantPractitionerRef,
          assignedToPractitionerRef: encounterRefs.assignedToPractitionerRef ?? null,
          locationRef: encounterRefs.locationRef,
          organizationRef: encounterRefs.organizationRef ?? null,
        },
        ehrWritebackEncounterExtensionUrls: extUrls,
        ehrWritebackVersion: WRITEBACK_VERSION,
      })
      console.log('[EHR Writeback] Encounter payload logged', {
        practiceId,
        callId: call.call_id,
        writebackVersion: WRITEBACK_VERSION,
        issuerTelephoneBucket,
        encounterExtensionUrls: extUrls,
        telephoneEncounterBundleShape: TELEPHONE_ENCOUNTER_BUNDLE_DIRECT_ECW_OPTIONS,
        encounterTimeZone: ehrTimeZone || null,
        payloadSize: JSON.stringify(encounterBundle).length,
      })
      console.log('[EHR Writeback] Encounter payload', {
        practiceId,
        callId: call.call_id,
        writebackVersion: WRITEBACK_VERSION,
        payload: encounterBundle,
      })
      const encounterResponse = (await client.request('/', {
        method: 'POST',
        body: JSON.stringify(encounterBundle),
      })) as any
      const encounterStatus = encounterResponse?.entry?.[0]?.response?.status as string | undefined
      if (!isSuccessfulTransactionStatus(encounterStatus)) {
        const hint = ecwTransactionFailureHint(encounterStatus)
        throw new Error(
          `Encounter transaction failed: ${encounterStatus || 'missing_status'}${hint}`
        )
      }
      const encounterLocation = encounterResponse?.entry?.[0]?.response?.location as
        | string
        | undefined
      encounterId = extractResourceIdFromLocation(encounterLocation, 'Encounter') || null
      encounterUrl = encounterId ? `${client.getBaseUrl()}/Encounter/${encounterId}` : null
      // No PUT — ECW's background process finalizes past-dated encounters to status=finished
      // within minutes, which is what makes them addressable by staff. A PUT pre-empts that
      // finalization and leaves status=arrived permanently.
      await logEhrAudit({
        tenantId: practiceId,
        actorUserId: null,
        action: 'FHIR_WRITE',
        providerId: connection.providerId,
        entity: 'Encounter',
        entityId: encounterId || undefined,
        metadata: {
          patientId: ehrPatientId,
          callId: call.call_id,
          noteType: 'telephone_encounter',
        },
      })
    }

    let created: { id?: string; reviewUrl?: string | null } | null = null
    if (wantsNotes) {
      created = await createDraftDocumentReference({
        client,
        patientId: ehrPatientId,
        noteText,
        preferPreliminary: false,
        capabilityStatement,
        skipCapabilityCheck: connection.providerId.startsWith('ecw'),
        useTransaction: connection.providerId.startsWith('ecw'),
      })
    }

    let telephoneNoteId: string | null = null
    let telephoneNoteUrl: string | null = null
    if (wantsNotes && encounterNoteText) {
      const telephoneNote = await createDraftDocumentReference({
        client,
        patientId: ehrPatientId,
        noteText: encounterNoteText,
        preferPreliminary: false,
        capabilityStatement,
        skipCapabilityCheck: connection.providerId.startsWith('ecw'),
        useTransaction: connection.providerId.startsWith('ecw'),
      })
      telephoneNoteId = telephoneNote.id || null
      telephoneNoteUrl = telephoneNote.reviewUrl || null
      await logEhrAudit({
        tenantId: practiceId,
        actorUserId: null,
        action: 'FHIR_WRITE',
        providerId: connection.providerId,
        entity: 'DocumentReference',
        entityId: telephoneNote.id || undefined,
        metadata: {
          patientId: ehrPatientId,
          callId: call.call_id,
          noteType: 'telephone_encounter',
        },
      })
    }

    if (created?.id) {
      await logEhrAudit({
        tenantId: practiceId,
        actorUserId: null,
        action: 'FHIR_WRITE',
        providerId: connection.providerId,
        entity: 'DocumentReference',
        entityId: created.id,
        metadata: {
          patientId: ehrPatientId,
          callId: call.call_id,
        },
      })
    }

    const didAnyWrite =
      ehrPatientCreatedInEcw ||
      Boolean(encounterId) ||
      Boolean(created?.id) ||
      Boolean(telephoneNoteId)

    if (!didAnyWrite) {
      await markConversationMetadata(practiceId, call.call_id, {
        ehrWritebackStatus: 'skipped',
        ehrWritebackError:
          'No eCW resources were written (layers disabled or no applicable telephone encounter content).',
        ehrWritebackFailedAt: new Date().toISOString(),
        ehrWritebackVersion: WRITEBACK_VERSION,
        ehrWritebackLayersSummary: {
          patientCreateInEcw: ehrPatientCreatedInEcw,
          encounterWritten: Boolean(encounterId),
          callSummaryNoteWritten: Boolean(created?.id),
          telephoneDraftNoteWritten: Boolean(telephoneNoteId),
          layersConfigured: {
            patientCreate: layers.allowPatientCreate,
            encounter: layers.allowEncounter,
            draftNotes: layers.allowDraftNotes,
            encounterAndNotesWhenNewPatient:
              settings?.ehrRetellWritebackEncounterAndNotesWhenNewPatient !== false,
            encounterAndNotesWhenExistingPatient:
              settings?.ehrRetellWritebackEncounterAndNotesWhenExistingPatient !== false,
          },
          patientMode,
          encounterNotesByMode,
        },
      })
      return { status: 'skipped', reason: 'retell_writeback_nothing_written' }
    }

    await markConversationMetadata(practiceId, call.call_id, {
      ehrWritebackStatus: 'success',
      ehrWritebackCompletedAt: new Date().toISOString(),
      ehrWritebackNoteId: created?.id || null,
      ehrWritebackReviewUrl: created?.reviewUrl || null,
      ehrWritebackTelephoneNoteId: telephoneNoteId,
      ehrWritebackTelephoneNoteUrl: telephoneNoteUrl,
      ehrWritebackEncounterId: encounterId,
      ehrWritebackEncounterUrl: encounterUrl,
      ehrWritebackEncounterNoteLength: encounterNoteText?.length ?? 0,
      ehrWritebackEncounterNotePreview: encounterNotePreview,
      ehrWritebackPatientId: ehrPatientId,
      ehrWritebackPatientCreatedInEcw: ehrPatientCreatedInEcw,
      ehrWritebackError: null,
      ehrWritebackFailedAt: null,
      ehrWritebackVersion: WRITEBACK_VERSION,
      ehrWritebackLayersSummary: {
        patientCreateInEcw: ehrPatientCreatedInEcw,
        encounterWritten: Boolean(encounterId),
        callSummaryNoteWritten: Boolean(created?.id),
        telephoneDraftNoteWritten: Boolean(telephoneNoteId),
        layersConfigured: {
          patientCreate: layers.allowPatientCreate,
          encounter: layers.allowEncounter,
          draftNotes: layers.allowDraftNotes,
          encounterAndNotesWhenNewPatient:
            settings?.ehrRetellWritebackEncounterAndNotesWhenNewPatient !== false,
          encounterAndNotesWhenExistingPatient:
            settings?.ehrRetellWritebackEncounterAndNotesWhenExistingPatient !== false,
        },
        patientMode,
        encounterNotesByMode,
      },
    })

    console.log('[EHR Writeback] Success', {
      practiceId,
      callId: call.call_id,
      ehrPatientId,
      noteId: created?.id || null,
      reviewUrl: created?.reviewUrl || null,
    })

    return { status: 'success', noteId: created?.id, reviewUrl: created?.reviewUrl ?? undefined }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'EHR writeback failed'
    if (error instanceof WriteNotSupportedError) {
      console.error('[EHR Writeback] Not supported', {
        practiceId,
        callId: call.call_id,
        supportedInteractions: error.supportedInteractions,
        writebackVersion: WRITEBACK_VERSION,
      })
      await markConversationMetadata(practiceId, call.call_id, {
        ehrWritebackStatus: 'error',
        ehrWritebackError: 'Write not supported by EHR',
        ehrWritebackFailedAt: new Date().toISOString(),
        ehrWritebackSupportedInteractions: error.supportedInteractions,
        ehrWritebackVersion: WRITEBACK_VERSION,
      })
      return { status: 'error', reason: 'write_not_supported' }
    }
    console.error('[EHR Writeback] Failed', {
      practiceId,
      callId: call.call_id,
      error: message,
      writebackVersion: WRITEBACK_VERSION,
    })
    await markConversationMetadata(practiceId, call.call_id, {
      ehrWritebackStatus: 'error',
      ehrWritebackError: message,
      ehrWritebackFailedAt: new Date().toISOString(),
      ehrWritebackVersion: WRITEBACK_VERSION,
    })
    return { status: 'error', reason: 'exception' }
  }
}

export async function syncPatientNoteToEhrEncounter(params: {
  practiceId: string
  patientId: string
  noteType: string
  content: string
  actorUserId: string
}) {
  const { practiceId, patientId, noteType, content, actorUserId } = params
  if (!ENCOUNTER_NOTE_TYPES.includes(noteType as any)) {
    return { status: 'skipped', reason: 'note_type_not_supported' }
  }
  const settings = await getEhrSettings(practiceId)
  if (!settings?.enabledProviders?.includes(WRITEBACK_PROVIDER_ID as any)) {
    return { status: 'skipped', reason: 'provider_not_enabled' }
  }
  if (!settings.enableWrite) {
    return { status: 'skipped', reason: 'write_disabled' }
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, practiceId, deletedAt: null },
  })
  if (!patient?.externalEhrId) {
    return { status: 'skipped', reason: 'missing_ehr_id' }
  }

  const conversations = await prisma.voiceConversation.findMany({
    where: {
      practiceId,
      patientId,
      metadata: { not: Prisma.JsonNull },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  })
  const encounterId =
    conversations
      .map((conversation) =>
        conversation.metadata && typeof conversation.metadata === 'object'
          ? (conversation.metadata as Record<string, unknown>)
          : null
      )
      .map((metadata) => (metadata?.ehrWritebackEncounterId as string | undefined) || null)
      .find(Boolean) || null
  const hasRecentCallManagedWriteback = conversations.some((conversation) => {
    if (!conversation.metadata || typeof conversation.metadata !== 'object') return false
    const metadata = conversation.metadata as Record<string, unknown>
    if (metadata.ehrWritebackProviderId !== WRITEBACK_PROVIDER_ID) return false
    const status = metadata.ehrWritebackStatus
    if (status !== 'in_progress' && status !== 'success') return false
    const startedAtRaw = metadata.ehrWritebackStartedAt
    if (typeof startedAtRaw !== 'string' || !startedAtRaw) return true
    const startedAt = new Date(startedAtRaw).getTime()
    if (Number.isNaN(startedAt)) return true
    // Guard against race conditions where manual note sync runs before
    // call writeback has persisted the canonical encounter/message content.
    return Date.now() - startedAt < 2 * 60 * 60 * 1000
  })
  let resolvedEncounterId = encounterId

  if (noteType === 'telephone_encounter' && hasRecentCallManagedWriteback) {
    return { status: 'skipped', reason: 'telephone_encounter_managed_by_call_writeback' }
  }

  const connections = await prisma.ehrConnection.findMany({
    where: {
      tenantId: practiceId,
      providerId: WRITEBACK_PROVIDER_ID,
      authFlow: 'backend_services',
      status: 'connected',
    },
    orderBy: { updatedAt: 'desc' },
  })
  const connection = connections[0]
  if (!connection?.accessTokenEnc) {
    return { status: 'skipped', reason: 'missing_connection' }
  }

  const refreshedConnection = await refreshBackendConnectionIfNeeded({ connection })
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
      accessToken: decryptString(refreshedConnection.accessTokenEnc!),
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
      await logEhrAudit({
        tenantId: practiceId,
        actorUserId,
        action: 'EHR_TOKEN_REFRESH',
        providerId: connection.providerId,
        entity: 'EhrConnection',
        entityId: connection.id,
      })
    },
    timeoutMs: 120_000,
  })

  const startTime = new Date()
  const endTime = new Date(startTime.getTime() + 15 * 60 * 1000)
  const noteText = formatEncounterNote(noteType, content)
  const issuerTelephoneBucket = telephoneDefaultBucketFromIssuer(refreshedConnection.issuer)
  const encounterRefs = resolveEcwTelephoneEncounterRefs(settings, refreshedConnection.issuer)
  const ehrTimeZone = settings?.ehrTimeZone || undefined
  console.log('[EHR Note Sync] Telephone encounter ref resolution', {
    practiceId,
    patientId,
    issuerTelephoneBucket,
    participantPractitionerRef: encounterRefs.participantPractitionerRef,
    assignedToPractitionerRef: encounterRefs.assignedToPractitionerRef,
    locationRef: encounterRefs.locationRef,
    organizationRef: encounterRefs.organizationRef,
    telephoneEncounterBundleShape: TELEPHONE_ENCOUNTER_BUNDLE_DIRECT_ECW_OPTIONS,
  })
  const missingRefs = missingEncounterRefs(encounterRefs)
  if (missingRefs.length > 0) {
    return { status: 'error', reason: `missing_encounter_refs_${missingRefs.join('_')}` }
  }
  const ehrPatientIdForEncounter = normalizeStoredEhrPatientId(patient.externalEhrId)
  if (!resolvedEncounterId) {
    const createBundle = buildTelephoneEncounterBundle({
      patientId: ehrPatientIdForEncounter,
      noteText,
      startTime,
      endTime,
      refs: encounterRefs,
      timeZone: ehrTimeZone,
      ...TELEPHONE_ENCOUNTER_BUNDLE_DIRECT_ECW_OPTIONS,
    })
    const createResponse = (await client.request('/', {
      method: 'POST',
      body: JSON.stringify(createBundle),
    })) as any
    const createStatus = createResponse?.entry?.[0]?.response?.status as string | undefined
    if (!isSuccessfulTransactionStatus(createStatus)) {
      return { status: 'error', reason: `encounter_create_failed_${createStatus || 'missing_status'}` }
    }
    const createLocation = createResponse?.entry?.[0]?.response?.location as string | undefined
    resolvedEncounterId = extractResourceIdFromLocation(createLocation, 'Encounter') || null
  }

  if (!resolvedEncounterId) {
    return { status: 'error', reason: 'missing_encounter_id' }
  }

  const updateBundle = buildTelephoneEncounterBundle({
    patientId: ehrPatientIdForEncounter,
    noteText,
    startTime,
    endTime,
    refs: encounterRefs,
    encounterId: resolvedEncounterId,
    requestMethod: 'PUT',
    timeZone: ehrTimeZone,
    ...TELEPHONE_ENCOUNTER_BUNDLE_DIRECT_ECW_OPTIONS,
  })
  let persistedId: string | null = null
  try {
    const encounterResponse = (await client.request('/', {
      method: 'POST',
      body: JSON.stringify(updateBundle),
    })) as any
    const updateEntry = encounterResponse?.entry?.[0] as any
    if (updateEntry?.resource?.resourceType === 'OperationOutcome') {
      console.warn('[EHR Note Sync] Encounter PUT returned OperationOutcome; using create id', {
        practiceId,
        patientId,
        encounterId: resolvedEncounterId,
        outcome: updateEntry.resource,
      })
    } else {
      const updateStatus = updateEntry?.response?.status as string | undefined
      if (!isSuccessfulTransactionStatus(updateStatus)) {
        console.warn('[EHR Note Sync] Encounter PUT non-success or empty status', {
          practiceId,
          patientId,
          encounterId: resolvedEncounterId,
          updateStatus,
        })
      }
      const encounterLocation = updateEntry?.response?.location as string | undefined
      persistedId = extractResourceIdFromLocation(encounterLocation, 'Encounter') || null
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('[EHR Note Sync] Encounter PUT failed (timeout/outcome); create likely persisted', {
      practiceId,
      patientId,
      encounterId: resolvedEncounterId,
      error: message,
    })
  }

  await logEhrAudit({
    tenantId: practiceId,
    actorUserId,
    action: 'FHIR_WRITE',
    providerId: connection.providerId,
    entity: 'Encounter',
    entityId: persistedId || resolvedEncounterId || undefined,
    metadata: {
      patientId: patient.id,
      noteType,
    },
  })
  return { status: 'success', encounterId: persistedId || resolvedEncounterId }
}
