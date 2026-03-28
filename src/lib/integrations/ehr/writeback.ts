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
import type { RetellCall } from '@/lib/retell-api'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'

const WRITEBACK_PROVIDER_ID = 'ecw_write'
const ECW_PATIENT_IDENTIFIER_SYSTEM = 'urn:oid:2.16.840.1.113883.4.391.326070'
const ECW_PATIENT_IDENTIFIER_VALUE = '15455'
const ECW_TELEPHONE_PRACTITIONER =
  'Practitioner/Lt2IFR5Ah76n4d8TFP5gBPiX1g1-Q2P9s8IYoGZvbFM'
const ECW_TELEPHONE_ASSIGNED_TO_PRACTITIONER =
  'Practitioner/Lt2IFR5Ah76n4d8TFP5gBAfrwqxiesg83cejztPkOEI'
const ECW_TELEPHONE_LOCATION =
  'Location/Lt2IFR5Ah76n4d8TFP5gBFO4aIYpuamqju2XjvYx6Ik'
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

function extractResourceIdFromLocation(
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

function formatChicagoIso(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
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
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get(
      'minute'
    )}:${get('second')}${offset}`
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
  const fallback = detailed || summary || buildCallNoteText(call, extractedData)
  return ['Telephone encounter note', '', 'Detailed Call Summary:', fallback].join('\n')
}

function buildTelephoneEncounterBundle(params: {
  patientId: string
  noteText: string
  startTime: Date
  endTime: Date
  encounterId?: string
  requestMethod?: 'POST' | 'PUT'
}) {
  const bundleId = randomUUID()
  const encounterId = params.encounterId || randomUUID()
  const requestMethod = params.requestMethod || 'POST'
  const requestUrl = requestMethod === 'PUT' ? `Encounter/${encounterId}` : 'Encounter'
  const noteWithAttribution = `${params.noteText}\nThis encounter is created by VantageAI app at ${formatChicagoIso(
    params.startTime
  )}`
  return {
    resourceType: 'Bundle',
    id: bundleId,
    meta: { lastUpdated: formatChicagoIso(new Date()) },
    type: 'transaction',
    entry: [
      {
        resource: {
          resourceType: 'Encounter',
          id: encounterId,
          meta: {
            lastUpdated: formatChicagoIso(new Date()),
            profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter'],
          },
          extension: [
            {
              url: 'http://eclinicalworks.com/supportingInfo/telephoneEncounter/messages',
              valueString: noteWithAttribution,
            },
            {
              url: 'http://eclinicalworks.com/supportingInfo/telephoneEncounter/notes',
              valueString: noteWithAttribution,
            },
            {
              url: 'http://eclinicalworks.com/supportingInfo/telephoneEncounter/assignedTo',
              valueReference: {
                reference: ECW_TELEPHONE_ASSIGNED_TO_PRACTITIONER,
              },
            },
          ],
          status: 'planned',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'VR',
            display: 'virtual',
          },
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
          subject: { reference: `Patient/${params.patientId}` },
          participant: [
            {
              individual: { reference: ECW_TELEPHONE_PRACTITIONER, type: 'Practitioner' },
            },
          ],
          period: {
            start: formatChicagoIso(params.startTime),
            end: formatChicagoIso(params.endTime),
          },
          reasonCode: [{ text: 'Telephone encounter' }],
          location: [
            {
              location: { reference: ECW_TELEPHONE_LOCATION, type: 'Location' },
            },
          ],
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
  if (!call.call_id) {
    return { status: 'skipped', reason: 'missing_call_id' }
  }

  console.log('[EHR Writeback] Start', {
    practiceId,
    callId: call.call_id,
    patientId,
    hasExtractedName: Boolean(extractedData.patient_name),
    hasExtractedPhone: Boolean(extractedData.user_phone_number),
  })

  const settings = await getEhrSettings(practiceId)

  await markConversationMetadata(practiceId, call.call_id, {
    ehrWritebackStatus: 'in_progress',
    ehrWritebackStartedAt: new Date().toISOString(),
    ehrWritebackProviderId: WRITEBACK_PROVIDER_ID,
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
      })
      await markConversationMetadata(practiceId, call.call_id, {
        ehrWritebackStatus: 'error',
        ehrWritebackError: 'No backend services connection for writeback provider.',
        ehrWritebackFailedAt: new Date().toISOString(),
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
    let patientRecord = null
    if (patientId) {
      patientRecord = await prisma.patient.findUnique({
        where: { id: patientId },
      })
      ehrPatientId = patientRecord?.externalEhrId || null
    }

    const patientMode = resolvePatientMode({ extractedData })
    const lookupBirthDate =
      parseDobToIso(extractedData.patient_dob) ||
      (patientRecord?.dateOfBirth
        ? patientRecord.dateOfBirth.toISOString().split('T')[0]
        : null)
    const lookupName = patientRecord?.name || extractedData.patient_name || null
    const lookupPhone =
      patientRecord?.primaryPhone ||
      patientRecord?.phone ||
      extractedData.patient_phone_number ||
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

    if (!ehrPatientId && settings?.enablePatientCreate && patientRecord && patientMode === 'new') {
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
        }
      }
    }

    if (!ehrPatientId) {
      console.error('[EHR Writeback] Missing EHR patient ID', {
        practiceId,
        callId: call.call_id,
        patientId,
      })
      await markConversationMetadata(practiceId, call.call_id, {
        ehrWritebackStatus: 'error',
        ehrWritebackError: 'Missing EHR patient ID for writeback.',
        ehrWritebackFailedAt: new Date().toISOString(),
      })
      return { status: 'error', reason: 'missing_patient_id' }
    }

    const noteText = buildCallNoteText(call, extractedData)
    const encounterNoteText = buildTelephoneEncounterNoteText(call, extractedData)
    let encounterId: string | null = null
    let encounterUrl: string | null = null
    if (encounterNoteText) {
      const startTime = new Date()
      const endTime = new Date(startTime.getTime() + 15 * 60 * 1000)
      const encounterBundle = buildTelephoneEncounterBundle({
        patientId: ehrPatientId,
        noteText: encounterNoteText,
        startTime,
        endTime,
      })
      const encounterResponse = (await client.request('/', {
        method: 'POST',
        body: JSON.stringify(encounterBundle),
      })) as any
      const encounterStatus = encounterResponse?.entry?.[0]?.response?.status as string | undefined
      if (!encounterStatus || !encounterStatus.startsWith('2')) {
        throw new Error(
          `Encounter transaction failed: ${encounterStatus || 'missing_status'}`
        )
      }
      const encounterLocation = encounterResponse?.entry?.[0]?.response?.location as
        | string
        | undefined
      encounterId = extractResourceIdFromLocation(encounterLocation, 'Encounter') || null
      encounterUrl = encounterId ? `${client.getBaseUrl()}/Encounter/${encounterId}` : null
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
    const created = await createDraftDocumentReference({
      client,
      patientId: ehrPatientId,
      noteText,
      preferPreliminary: false,
      capabilityStatement,
      skipCapabilityCheck: connection.providerId.startsWith('ecw'),
      useTransaction: connection.providerId.startsWith('ecw'),
    })

    const telephoneNoteText = buildTelephoneEncounterNoteText(call, extractedData)
    let telephoneNoteId: string | null = null
    let telephoneNoteUrl: string | null = null
    if (telephoneNoteText) {
      const telephoneNote = await createDraftDocumentReference({
        client,
        patientId: ehrPatientId,
        noteText: telephoneNoteText,
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

    await logEhrAudit({
      tenantId: practiceId,
      actorUserId: null,
      action: 'FHIR_WRITE',
      providerId: connection.providerId,
      entity: 'DocumentReference',
      entityId: created.id || undefined,
      metadata: {
        patientId: ehrPatientId,
        callId: call.call_id,
      },
    })

    await markConversationMetadata(practiceId, call.call_id, {
      ehrWritebackStatus: 'success',
      ehrWritebackCompletedAt: new Date().toISOString(),
      ehrWritebackNoteId: created.id || null,
      ehrWritebackReviewUrl: created.reviewUrl || null,
      ehrWritebackTelephoneNoteId: telephoneNoteId,
      ehrWritebackTelephoneNoteUrl: telephoneNoteUrl,
      ehrWritebackEncounterId: encounterId,
      ehrWritebackEncounterUrl: encounterUrl,
      ehrWritebackPatientId: ehrPatientId,
      ehrWritebackError: null,
      ehrWritebackFailedAt: null,
    })

    console.log('[EHR Writeback] Success', {
      practiceId,
      callId: call.call_id,
      ehrPatientId,
      noteId: created.id || null,
      reviewUrl: created.reviewUrl || null,
    })

    return { status: 'success', noteId: created.id, reviewUrl: created.reviewUrl }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'EHR writeback failed'
    if (error instanceof WriteNotSupportedError) {
      console.error('[EHR Writeback] Not supported', {
        practiceId,
        callId: call.call_id,
        supportedInteractions: error.supportedInteractions,
      })
      await markConversationMetadata(practiceId, call.call_id, {
        ehrWritebackStatus: 'error',
        ehrWritebackError: 'Write not supported by EHR',
        ehrWritebackFailedAt: new Date().toISOString(),
        ehrWritebackSupportedInteractions: error.supportedInteractions,
      })
      return { status: 'error', reason: 'write_not_supported' }
    }
    console.error('[EHR Writeback] Failed', {
      practiceId,
      callId: call.call_id,
      error: message,
    })
    await markConversationMetadata(practiceId, call.call_id, {
      ehrWritebackStatus: 'error',
      ehrWritebackError: message,
      ehrWritebackFailedAt: new Date().toISOString(),
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
  let resolvedEncounterId = encounterId

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
  })

  const startTime = new Date()
  const endTime = new Date(startTime.getTime() + 15 * 60 * 1000)
  const noteText = formatEncounterNote(noteType, content)
  if (!resolvedEncounterId) {
    const createBundle = buildTelephoneEncounterBundle({
      patientId: patient.externalEhrId,
      noteText,
      startTime,
      endTime,
    })
    const createResponse = (await client.request('/', {
      method: 'POST',
      body: JSON.stringify(createBundle),
    })) as any
    const createLocation = createResponse?.entry?.[0]?.response?.location as string | undefined
    resolvedEncounterId = extractResourceIdFromLocation(createLocation, 'Encounter') || null
  }

  if (!resolvedEncounterId) {
    return { status: 'error', reason: 'missing_encounter_id' }
  }

  const updateBundle = buildTelephoneEncounterBundle({
    patientId: patient.externalEhrId,
    noteText,
    startTime,
    endTime,
    encounterId: resolvedEncounterId,
    requestMethod: 'PUT',
  })
  const encounterResponse = (await client.request('/', {
    method: 'POST',
    body: JSON.stringify(updateBundle),
  })) as any
  const encounterLocation = encounterResponse?.entry?.[0]?.response?.location as string | undefined
  const persistedId = extractResourceIdFromLocation(encounterLocation, 'Encounter') || null
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
