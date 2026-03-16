import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import {
  getEhrSettings,
  getPrivateKeyJwtConfig,
  getEcwClientAssertionAud,
} from '@/lib/integrations/ehr/server'
import { createClientAssertion } from '@/lib/integrations/ehr/smartEngine'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'
import { FhirClient } from '@/lib/integrations/fhir/fhirClient'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import { createPatient } from '@/lib/integrations/fhir/resources/patient'

const UPDATE_PROVIDER_ID = 'ecw_write'
const ECW_PATIENT_IDENTIFIER_SYSTEM = 'urn:oid:2.16.840.1.113883.4.391.326070'
const ECW_PATIENT_IDENTIFIER_VALUE = '15455'
type TelecomEntry = { system?: string; value?: string; use?: string }

function formatEcwPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return value
}

function mergeTelecom(base: TelecomEntry[] | undefined, updates: TelecomEntry[]) {
  const normalized = new Map<string, TelecomEntry>()
  for (const entry of base || []) {
    if (!entry?.system) continue
    normalized.set(entry.system, { ...entry })
  }
  for (const update of updates) {
    if (!update?.system) continue
    normalized.set(update.system, { ...(normalized.get(update.system) || {}), ...update })
  }
  return Array.from(normalized.values()).filter((entry) => entry.value)
}

function buildUpdatePayload(
  basePatient: any,
  updates: { email?: string | null; phone?: string | null },
  requestUrl: string,
  options?: { formatEcwPhone?: boolean }
) {
  const telecomUpdates: TelecomEntry[] = []
  if (updates.phone) {
    const phoneValue = options?.formatEcwPhone ? formatEcwPhone(updates.phone) : updates.phone
    telecomUpdates.push({ system: 'phone', value: phoneValue, use: 'home' })
  }
  if (updates.email) {
    telecomUpdates.push({ system: 'email', value: updates.email, use: 'home' })
  }

  const resource: any = {
    ...basePatient,
    resourceType: 'Patient',
    id: basePatient?.id,
    meta: basePatient?.meta
      ? {
          ...basePatient.meta,
          profile: basePatient.meta.profile || [
            'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
          ],
        }
      : {
          profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'],
        },
    telecom: mergeTelecom(basePatient?.telecom, telecomUpdates),
  }

  return {
    resourceType: 'Bundle',
    id: '',
    meta: { lastUpdated: new Date().toISOString() },
    type: 'transaction',
    entry: [
      {
        resource,
        request: { method: 'PUT', url: requestUrl },
      },
    ],
  }
}

function extractResponseStatus(payload: any) {
  const entry = payload?.entry?.[0]
  return entry?.response?.status || entry?.response?.statusCode || null
}

export async function syncPatientUpdateToEhr(params: {
  practiceId: string
  patientId: string
  email?: string | null
  phone?: string | null
  actorUserId: string
}) {
  const { practiceId, patientId, email, phone, actorUserId } = params
  if (!email && !phone) {
    return { status: 'skipped', reason: 'no_fields' }
  }

  console.log('[EHR Patient Update] Start', {
    practiceId,
    patientId,
    hasEmail: Boolean(email),
    hasPhone: Boolean(phone),
  })

  const settings = await getEhrSettings(practiceId)
  if (!settings?.enabledProviders?.includes(UPDATE_PROVIDER_ID as any)) {
    console.warn('[EHR Patient Update] Skipped - provider not enabled', {
      practiceId,
      patientId,
      providerId: UPDATE_PROVIDER_ID,
    })
    return { status: 'skipped', reason: 'provider_not_enabled' }
  }
  if (!settings.enableWrite) {
    console.warn('[EHR Patient Update] Skipped - write disabled', {
      practiceId,
      patientId,
      enableWrite: settings.enableWrite,
    })
    return { status: 'skipped', reason: 'write_disabled' }
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } })
  if (!patient?.externalEhrId) {
    console.warn('[EHR Patient Update] Skipped - missing externalEhrId', {
      practiceId,
      patientId,
    })
    return { status: 'skipped', reason: 'missing_ehr_id' }
  }

  const connections = await prisma.ehrConnection.findMany({
    where: { tenantId: practiceId, providerId: UPDATE_PROVIDER_ID },
    orderBy: { updatedAt: 'desc' },
  })
  const connection = connections.find((candidate) => candidate.authFlow === 'backend_services')
  if (!connection?.accessTokenEnc) {
    console.error('[EHR Patient Update] Missing backend connection', {
      practiceId,
      patientId,
      providerId: UPDATE_PROVIDER_ID,
    })
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
    timeoutMs: 30000,
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

  let updated: unknown
  try {
    const basePatient = (await client.request(`/Patient/${patient.externalEhrId}`)) as {
      id?: string
      meta?: { profile?: string[] }
      extension?: any
      identifier?: any
      active?: boolean
      name?: any
      telecom?: any
      birthDate?: string
      gender?: string
      address?: any
      contact?: any
      generalPractitioner?: any
      communication?: any
    }
    const bundle = buildUpdatePayload(basePatient, { email, phone }, 'Patient', {
      formatEcwPhone: connection.providerId.startsWith('ecw'),
    })
    console.log('[EHR Patient Update] Payload', {
      practiceId,
      patientId,
      ehrPatientId: patient.externalEhrId,
      payload: JSON.stringify(bundle),
    })
    updated = await client.request('/', {
      method: 'POST',
      body: JSON.stringify(bundle),
    })
    const status = extractResponseStatus(updated)
    if (status === '100' && basePatient?.id) {
      console.warn('[EHR Patient Update] Retry with FHIR id', {
        practiceId,
        patientId,
        ehrPatientId: basePatient.id,
        status,
      })
      const retryBundle = buildUpdatePayload(basePatient, { email, phone }, `Patient/${basePatient.id}`, {
        formatEcwPhone: connection.providerId.startsWith('ecw'),
      })
      updated = await client.request('/', {
        method: 'POST',
        body: JSON.stringify(retryBundle),
      })
    }
    console.log('[EHR Patient Update] Success', {
      practiceId,
      patientId,
      ehrPatientId: patient.externalEhrId,
      responseStatus: extractResponseStatus(updated),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'EHR update failed'
    console.error('[EHR Patient Update] Failed', {
      practiceId,
      patientId,
      ehrPatientId: patient.externalEhrId,
      error: message,
    })
    throw error
  }

  await logEhrAudit({
    tenantId: practiceId,
    actorUserId,
    action: 'FHIR_WRITE',
    providerId: connection.providerId,
    entity: 'Patient',
    entityId: patient.externalEhrId,
    metadata: {
      patientId,
    },
  })

  return { status: 'success', response: updated }
}

export async function syncPatientCreateToEhr(params: {
  practiceId: string
  patientId: string
  actorUserId: string
}) {
  const { practiceId, patientId, actorUserId } = params

  console.log('[EHR Patient Create] Start', { practiceId, patientId })

  const settings = await getEhrSettings(practiceId)
  if (!settings?.enabledProviders?.includes(UPDATE_PROVIDER_ID as any)) {
    console.warn('[EHR Patient Create] Skipped - provider not enabled', {
      practiceId,
      patientId,
      providerId: UPDATE_PROVIDER_ID,
    })
    return { status: 'skipped', reason: 'provider_not_enabled' }
  }
  if (!settings.enableWrite || !settings.enablePatientCreate) {
    console.warn('[EHR Patient Create] Skipped - write disabled', {
      practiceId,
      patientId,
      enableWrite: settings.enableWrite,
      enablePatientCreate: settings.enablePatientCreate,
    })
    return { status: 'skipped', reason: 'write_disabled' }
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } })
  if (!patient) {
    console.warn('[EHR Patient Create] Skipped - patient not found', { practiceId, patientId })
    return { status: 'skipped', reason: 'missing_patient' }
  }
  if (patient.externalEhrId) {
    console.log('[EHR Patient Create] Skipped - already linked', {
      practiceId,
      patientId,
      externalEhrId: patient.externalEhrId,
    })
    return { status: 'skipped', reason: 'already_linked' }
  }

  const connections = await prisma.ehrConnection.findMany({
    where: { tenantId: practiceId, providerId: UPDATE_PROVIDER_ID },
    orderBy: { updatedAt: 'desc' },
  })
  const connection = connections.find((candidate) => candidate.authFlow === 'backend_services')
  if (!connection?.accessTokenEnc) {
    console.error('[EHR Patient Create] Missing backend connection', {
      practiceId,
      patientId,
      providerId: UPDATE_PROVIDER_ID,
    })
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

  const given = patient.firstName
    ? [patient.firstName]
    : patient.name
        .split(' ')
        .filter(Boolean)
        .slice(0, -1)
        .filter(Boolean)
  const family = patient.lastName || patient.name.split(' ').slice(-1).join(' ') || undefined
  const isEcw = connection.providerId.startsWith('ecw')
  const name = {
    given: given.length ? given : [patient.name],
    family,
    text: isEcw ? undefined : patient.name,
  }
  const telecom: Array<{ system: 'phone' | 'email'; value: string; use?: string }> = []
  if (patient.phone || patient.primaryPhone) {
    const phoneValue = patient.primaryPhone || patient.phone
    telecom.push({
      system: 'phone',
      value: isEcw && phoneValue ? formatEcwPhone(phoneValue) : phoneValue,
      use: 'home',
    })
  }
  if (patient.email) {
    telecom.push({ system: 'email', value: patient.email, use: isEcw ? undefined : 'home' })
  }
  const birthDate = patient.dateOfBirth ? patient.dateOfBirth.toISOString().split('T')[0] : undefined
  if (isEcw && !birthDate) {
    console.warn('[EHR Patient Create] Skipped - missing birthDate', {
      practiceId,
      patientId,
    })
    return { status: 'skipped', reason: 'missing_birthdate' }
  }

  let created: any
  try {
    const capabilityStatement = await client.getCapabilityStatement()
    const payload = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            meta: {
              profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'],
            },
            identifier: isEcw
              ? [
                  {
                    use: 'usual',
                    system: ECW_PATIENT_IDENTIFIER_SYSTEM,
                    value: ECW_PATIENT_IDENTIFIER_VALUE,
                  },
                ]
              : undefined,
            name: [
              {
                use: 'usual',
                family: name.family,
                given: name.given,
              },
            ],
            telecom: telecom.length
              ? telecom.map((item) => ({
                  system: item.system,
                  value: item.value,
                  ...(item.use ? { use: item.use } : {}),
                }))
              : undefined,
            gender: patient.gender || 'unknown',
            birthDate,
          },
          request: {
            method: 'POST',
            url: 'Patient',
          },
        },
      ],
    }
    console.log('[EHR Patient Create] Payload', {
      practiceId,
      patientId,
      payload: JSON.stringify(payload),
    })
    created = await createPatient(
      client,
      {
        name,
        telecom: telecom.length ? telecom : undefined,
        gender: patient.gender || 'unknown',
        birthDate,
        identifiers: isEcw
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
    const responseEntry = created?.entry?.[0]
    const responseMeta = responseEntry?.response
    const responseStatus = (responseMeta?.status || responseMeta?.statusCode) as string | undefined
    const responseLocation = (responseMeta?.location ||
      responseMeta?.locationHeader ||
      responseMeta?.url) as string | undefined
    const responseType = created?.resourceType as string | undefined
    const entryCount = Array.isArray(created?.entry) ? created.entry.length : 0
    console.log('[EHR Patient Create] Response', {
      practiceId,
      patientId,
      status: responseStatus,
      location: responseLocation,
      resourceType: responseType,
      entryCount,
    })
    if (responseEntry) {
      console.log('[EHR Patient Create] Response entry', {
        practiceId,
        patientId,
        entry: responseEntry,
      })
      if (responseEntry.resource?.resourceType === 'OperationOutcome') {
        console.error('[EHR Patient Create] OperationOutcome entry', {
          practiceId,
          patientId,
          outcome: JSON.stringify(responseEntry.resource),
        })
      }
    }
    if (responseType === 'Bundle' && !responseStatus && entryCount === 0) {
      console.error('[EHR Patient Create] Empty bundle response', {
        practiceId,
        patientId,
        response: created,
      })
    }
    if (responseType === 'OperationOutcome') {
      console.error('[EHR Patient Create] OperationOutcome', {
        practiceId,
        patientId,
        outcome: created,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'EHR create failed'
    console.error('[EHR Patient Create] Failed', {
      practiceId,
      patientId,
      error: message,
    })
    throw error
  }

  const responseEntry = created?.entry?.[0]
  const responseMeta = responseEntry?.response
  const location = (responseMeta?.location ||
    responseMeta?.locationHeader ||
    responseMeta?.url) as string | undefined
  let createdId = location?.includes('/') ? location.split('/')[1] : undefined
  if (!createdId) {
    createdId = responseEntry?.resource?.id as string | undefined
  }
  if (!createdId) {
    console.error('[EHR Patient Create] Missing created patient id', {
      practiceId,
      patientId,
      location,
    })
    return { status: 'error', reason: 'missing_created_id' }
  }

  if (createdId) {
    await prisma.patient.update({
      where: { id: patient.id },
      data: { externalEhrId: createdId },
    })
    await logEhrAudit({
      tenantId: practiceId,
      actorUserId,
      action: 'FHIR_WRITE',
      providerId: connection.providerId,
      entity: 'Patient',
      entityId: createdId,
      metadata: { patientId: patient.id },
    })
    console.log('[EHR Patient Create] Success', {
      practiceId,
      patientId,
      ehrPatientId: createdId,
    })
  }

  return { status: 'success', ehrPatientId: createdId }
}
