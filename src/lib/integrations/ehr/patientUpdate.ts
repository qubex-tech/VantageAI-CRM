import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import { getEhrSettings, getPrivateKeyJwtConfig } from '@/lib/integrations/ehr/server'
import { createClientAssertion } from '@/lib/integrations/ehr/smartEngine'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'
import { FhirClient } from '@/lib/integrations/fhir/fhirClient'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'

const UPDATE_PROVIDER_ID = 'ecw_write'

type TelecomEntry = { system?: string; value?: string; use?: string }

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

function buildUpdatePayload(basePatient: any, updates: { email?: string | null; phone?: string | null }) {
  const telecomUpdates: TelecomEntry[] = []
  if (updates.phone) {
    telecomUpdates.push({ system: 'phone', value: updates.phone, use: 'home' })
  }
  if (updates.email) {
    telecomUpdates.push({ system: 'email', value: updates.email, use: 'home' })
  }

  const resource: any = {
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
    extension: basePatient?.extension,
    identifier: basePatient?.identifier,
    active: basePatient?.active,
    name: basePatient?.name,
    telecom: mergeTelecom(basePatient?.telecom, telecomUpdates),
    birthDate: basePatient?.birthDate,
    gender: basePatient?.gender,
    address: basePatient?.address,
    contact: basePatient?.contact,
    generalPractitioner: basePatient?.generalPractitioner,
    communication: basePatient?.communication,
  }

  return {
    resourceType: 'Bundle',
    id: '',
    meta: { lastUpdated: new Date().toISOString() },
    type: 'transaction',
    entry: [
      {
        resource,
        request: { method: 'PUT', url: 'Patient' },
      },
    ],
  }
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

  const settings = await getEhrSettings(practiceId)
  if (!settings?.enabledProviders?.includes(UPDATE_PROVIDER_ID as any)) {
    return { status: 'skipped', reason: 'provider_not_enabled' }
  }
  if (!settings.enableWrite) {
    return { status: 'skipped', reason: 'write_disabled' }
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } })
  if (!patient?.externalEhrId) {
    return { status: 'skipped', reason: 'missing_ehr_id' }
  }

  const connections = await prisma.ehrConnection.findMany({
    where: { tenantId: practiceId, providerId: UPDATE_PROVIDER_ID },
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

  const basePatient = await client.request(`/Patient/${patient.externalEhrId}`)
  const bundle = buildUpdatePayload(basePatient, { email, phone })
  const updated = await client.request('/', {
    method: 'POST',
    body: JSON.stringify(bundle),
  })

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
