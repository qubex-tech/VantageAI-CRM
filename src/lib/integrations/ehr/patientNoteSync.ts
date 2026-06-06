import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import {
  getEhrSettings,
  getPrivateKeyJwtConfig,
  getEcwClientAssertionAud,
} from '@/lib/integrations/ehr/server'
import { createClientAssertion } from '@/lib/integrations/ehr/smartEngine'
import { FhirClient } from '@/lib/integrations/fhir/fhirClient'
import { createDraftDocumentReference } from '@/lib/integrations/fhir/resources/documentReference'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'
import { formatPatientNoteForEhr, isPatientNoteType } from '@/lib/patient-note-types'
import {
  resolveEhrSyncModeForNoteType,
  PATIENT_NOTE_TYPE_LABELS,
  type EhrPatientNoteSyncMode,
} from '@/lib/patient-note-ehr-sync'
import { syncPatientNoteToEhrEncounter } from '@/lib/integrations/ehr/writeback'
import type { EhrSettings } from '@/lib/integrations/ehr/types'

const WRITEBACK_PROVIDER_ID = 'ecw_write'

export type { EhrPatientNoteSyncMode, EhrPatientNoteSyncByType } from '@/lib/patient-note-ehr-sync'
export { resolveEhrSyncModeForNoteType, DEFAULT_EHR_PATIENT_NOTE_SYNC_BY_TYPE } from '@/lib/patient-note-ehr-sync'

function resolveModeFromSettings(settings: EhrSettings | null | undefined, noteType: string): EhrPatientNoteSyncMode {
  if (!isPatientNoteType(noteType)) return 'none'
  return resolveEhrSyncModeForNoteType(settings?.ehrPatientNoteSyncByType, noteType)
}

export type PatientNoteEhrSyncResult =
  | { status: 'skipped'; reason: string; mode: EhrPatientNoteSyncMode }
  | { status: 'success'; mode: EhrPatientNoteSyncMode; encounterId?: string; documentReferenceId?: string }
  | { status: 'error'; mode: EhrPatientNoteSyncMode; reason: string }

export async function syncPatientNoteToEhr(params: {
  practiceId: string
  patientId: string
  noteType: string
  content: string
  actorUserId: string
}): Promise<PatientNoteEhrSyncResult> {
  const settings = await getEhrSettings(params.practiceId)
  const mode = resolveModeFromSettings(settings, params.noteType)

  if (mode === 'none') {
    return { status: 'skipped', reason: 'sync_disabled_for_type', mode }
  }

  if (mode === 'telephone_encounter') {
    const result = await syncPatientNoteToEhrEncounter({
      practiceId: params.practiceId,
      patientId: params.patientId,
      noteType: params.noteType,
      content: params.content,
      actorUserId: params.actorUserId,
    })
    if (result.status === 'success') {
      return {
        status: 'success',
        mode,
        encounterId: result.encounterId,
      }
    }
    return {
      status: result.status === 'error' ? 'error' : 'skipped',
      mode,
      reason: result.reason || 'encounter_sync_failed',
    }
  }

  return syncPatientNoteToEhrDocumentReference(params)
}

async function syncPatientNoteToEhrDocumentReference(params: {
  practiceId: string
  patientId: string
  noteType: string
  content: string
  actorUserId: string
}): Promise<PatientNoteEhrSyncResult> {
  const mode: EhrPatientNoteSyncMode = 'document_reference'
  const { practiceId, patientId, noteType, content, actorUserId } = params

  if (!isPatientNoteType(noteType)) {
    return { status: 'skipped', reason: 'invalid_note_type', mode }
  }

  const settings = await getEhrSettings(practiceId)
  if (!settings?.enabledProviders?.includes(WRITEBACK_PROVIDER_ID as any)) {
    return { status: 'skipped', reason: 'provider_not_enabled', mode }
  }
  if (!settings.enableWrite || !settings.enableNoteCreate) {
    return { status: 'skipped', reason: 'write_or_note_create_disabled', mode }
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, practiceId, deletedAt: null },
    select: { id: true, externalEhrId: true },
  })
  if (!patient?.externalEhrId?.trim()) {
    return { status: 'skipped', reason: 'missing_ehr_id', mode }
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
    return { status: 'skipped', reason: 'missing_connection', mode }
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
    },
    timeoutMs: 120_000,
  })

  const capabilityStatement = await client.getCapabilityStatement()
  const noteText = formatPatientNoteForEhr(noteType, content)
  const typeLabel = PATIENT_NOTE_TYPE_LABELS[noteType]

  try {
    const created = await createDraftDocumentReference({
      client,
      patientId: patient.externalEhrId.replace(/^Patient\//i, '').split('/')[0],
      noteText,
      preferPreliminary: false,
      capabilityStatement,
      skipCapabilityCheck: connection.providerId.startsWith('ecw'),
      useTransaction: connection.providerId.startsWith('ecw'),
      categoryText: typeLabel,
      title: `Vantage - ${typeLabel}`,
      description: `Patient profile note from Vantage CRM (${typeLabel}).`,
    })

    await logEhrAudit({
      tenantId: practiceId,
      actorUserId,
      action: 'FHIR_WRITE',
      providerId: connection.providerId,
      entity: 'DocumentReference',
      entityId: created.id || undefined,
      metadata: {
        patientId: patient.id,
        noteType,
        source: 'patient_profile_note',
      },
    })

    return {
      status: 'success',
      mode,
      documentReferenceId: created.id || undefined,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'document_reference_sync_failed'
    return { status: 'error', mode, reason: message }
  }
}
