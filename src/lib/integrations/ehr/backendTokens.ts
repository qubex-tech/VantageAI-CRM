import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import { discoverSmartConfiguration } from '@/lib/integrations/ehr/discovery'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import { getPrivateKeyJwtConfig, getEcwClientAssertionAud } from '@/lib/integrations/ehr/server'
import { createClientAssertion, exchangeClientCredentials } from '@/lib/integrations/ehr/smartEngine'
import type { EhrConnection } from '@prisma/client'

const REFRESH_BUFFER_MS = 5 * 60 * 1000

function shouldRefresh(expiresAt: Date | null, now: Date) {
  if (!expiresAt) return true
  return expiresAt.getTime() - now.getTime() <= REFRESH_BUFFER_MS
}

export async function refreshBackendConnectionIfNeeded(params: {
  connection: EhrConnection
  now?: Date
  scopesOverride?: string
}) {
  const { connection } = params
  if (connection.authFlow !== 'backend_services') {
    return connection
  }
  const now = params.now || new Date()
  const expiresAt = connection.expiresAt ? new Date(connection.expiresAt) : null
  if (!shouldRefresh(expiresAt, now)) {
    return connection
  }
  return refreshBackendConnection({
    connection,
    now,
    scopesOverride: params.scopesOverride,
  })
}

export async function refreshBackendConnection(params: {
  connection: EhrConnection
  now?: Date
  scopesOverride?: string
}) {
  const { connection } = params
  const discovery = await discoverSmartConfiguration(connection.issuer)
  const tokenEndpoint = discovery.tokenEndpoint
  const privateKeyConfig = getPrivateKeyJwtConfig(connection.providerId)
  const audOverride = connection.providerId.startsWith('ecw')
    ? getEcwClientAssertionAud(connection.issuer)
    : undefined
  const clientAssertion = privateKeyConfig
    ? createClientAssertion({
        clientId: connection.clientId,
        tokenEndpoint,
        privateKeyPem: privateKeyConfig.privateKeyPem,
        keyId: privateKeyConfig.keyId,
        audience: audOverride,
      })
    : undefined
  const clientSecret =
    !privateKeyConfig && connection.clientSecretEnc
      ? decryptString(connection.clientSecretEnc)
      : undefined
  const scopes =
    params.scopesOverride || connection.scopesRequested || connection.scopesGranted || undefined

  const tokenResponse = await exchangeClientCredentials({
    tokenEndpoint,
    clientId: connection.clientId,
    clientSecret,
    clientAssertion,
    scopes,
  })

  const expiresAt = tokenResponse.expires_in
    ? new Date(Date.now() + tokenResponse.expires_in * 1000)
    : connection.expiresAt

  const updated = await prisma.ehrConnection.update({
    where: { id: connection.id },
    data: {
      status: 'connected',
      issuer: discovery.issuer,
      fhirBaseUrl: discovery.fhirBaseUrl,
      authorizationEndpoint: discovery.authorizationEndpoint,
      tokenEndpoint: discovery.tokenEndpoint,
      revocationEndpoint: discovery.revocationEndpoint,
      accessTokenEnc: encryptString(tokenResponse.access_token),
      refreshTokenEnc: tokenResponse.refresh_token
        ? encryptString(tokenResponse.refresh_token)
        : connection.refreshTokenEnc,
      expiresAt,
      scopesGranted: tokenResponse.scope || connection.scopesGranted,
    },
  })

  await logEhrAudit({
    tenantId: connection.tenantId,
    actorUserId: null,
    action: 'EHR_TOKEN_REFRESH',
    providerId: connection.providerId,
    entity: 'EhrConnection',
    entityId: connection.id,
    metadata: {
      authFlow: connection.authFlow,
      tokenEndpoint,
      scopes: tokenResponse.scope || scopes,
    },
  })

  return updated
}
