import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import { getEhrSettings, getPrivateKeyJwtConfig } from '@/lib/integrations/ehr/server'
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
): string | null {
  const detailed = extractedData.detailed_call_summary || call.call_analysis?.call_summary
  if (!detailed) return null
  return ['Telephone encounter note', '', 'Detailed Call Summary:', detailed].join('\n')
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
              valueString: params.noteText,
            },
            {
              url: 'http://eclinicalworks.com/supportingInfo/telephoneEncounter/notes',
              valueString: params.noteText,
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
  if (!settings?.enabledProviders?.includes(WRITEBACK_PROVIDER_ID as any)) {
    console.warn('[EHR Writeback] Skipped - provider not enabled', {
      practiceId,
      callId: call.call_id,
      providerId: WRITEBACK_PROVIDER_ID,
    })
    return { status: 'skipped', reason: 'provider_not_enabled' }
  }
  if (!settings.enableWrite || !settings.enableNoteCreate) {
    console.warn('[EHR Writeback] Skipped - write disabled', {
      practiceId,
      callId: call.call_id,
      enableWrite: settings.enableWrite,
      enableNoteCreate: settings.enableNoteCreate,
    })
    return { status: 'skipped', reason: 'write_disabled' }
  }

  const existingConversation = await prisma.voiceConversation.findFirst({
    where: { practiceId, retellCallId: call.call_id },
    select: { metadata: true },
  })
  const existingMetadata =
    existingConversation?.metadata && typeof existingConversation.metadata === 'object'
      ? (existingConversation.metadata as Record<string, unknown>)
      : {}
  if (existingMetadata.ehrWritebackStatus === 'success') {
    console.log('[EHR Writeback] Skipped - already written', {
      practiceId,
      callId: call.call_id,
      ehrWritebackPatientId: existingMetadata.ehrWritebackPatientId,
      ehrWritebackNoteId: existingMetadata.ehrWritebackNoteId,
    })
    return { status: 'skipped', reason: 'already_written' }
  }

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
      },
      orderBy: { updatedAt: 'desc' },
    })
    const connection = connections.find((candidate) => candidate.authFlow === 'backend_services')
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
      ? process.env.EHR_ECW_CLIENT_ASSERTION_AUD || undefined
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

    if (!ehrPatientId && settings.enablePatientCreate && patientRecord) {
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
        const birthDate = patientRecord.dateOfBirth
          ? patientRecord.dateOfBirth.toISOString().split('T')[0]
          : undefined
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
        const createdId = location?.includes('/') ? location.split('/')[1] : undefined
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
      const encounterLocation = encounterResponse?.entry?.[0]?.response?.location as
        | string
        | undefined
      encounterId = encounterLocation?.includes('/') ? encounterLocation.split('/')[1] : null
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
        preferPreliminary: true,
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
  if (!encounterId) {
    return { status: 'skipped', reason: 'missing_encounter_id' }
  }

  const connections = await prisma.ehrConnection.findMany({
    where: { tenantId: practiceId, providerId: WRITEBACK_PROVIDER_ID },
    orderBy: { updatedAt: 'desc' },
  })
  const connection = connections.find((candidate) => candidate.authFlow === 'backend_services')
  if (!connection?.accessTokenEnc) {
    return { status: 'skipped', reason: 'missing_connection' }
  }

  const refreshedConnection = await refreshBackendConnectionIfNeeded({ connection })
  const tokenEndpoint = refreshedConnection.tokenEndpoint || undefined
  const privateKeyConfig = tokenEndpoint ? getPrivateKeyJwtConfig(connection.providerId) : null
  const audOverride = connection.providerId.startsWith('ecw')
    ? process.env.EHR_ECW_CLIENT_ASSERTION_AUD || undefined
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
  const encounterBundle = buildTelephoneEncounterBundle({
    patientId: patient.externalEhrId,
    noteText: formatEncounterNote(noteType, content),
    startTime,
    endTime,
    encounterId,
    requestMethod: 'PUT',
  })
  const encounterResponse = (await client.request('/', {
    method: 'POST',
    body: JSON.stringify(encounterBundle),
  })) as any
  const encounterLocation = encounterResponse?.entry?.[0]?.response?.location as string | undefined
  const persistedId = encounterLocation?.includes('/') ? encounterLocation.split('/')[1] : null
  await logEhrAudit({
    tenantId: practiceId,
    actorUserId,
    action: 'FHIR_WRITE',
    providerId: connection.providerId,
    entity: 'Encounter',
    entityId: persistedId || encounterId || undefined,
    metadata: {
      patientId: patient.id,
      noteType,
    },
  })
  return { status: 'success', encounterId: persistedId || encounterId }
}
