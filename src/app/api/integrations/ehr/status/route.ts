import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import { resolveEhrPractice, getEhrSettings, getPrivateKeyJwtConfig } from '@/lib/integrations/ehr/server'
import { FhirClient } from '@/lib/integrations/fhir/fhirClient'
import { summarizeCapabilities } from '@/lib/integrations/fhir/capabilities'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import { createClientAssertion } from '@/lib/integrations/ehr/smartEngine'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'

const querySchema = z.object({
  providerId: z.string(),
  issuer: z.string().url().optional(),
  includeCapabilities: z.string().optional(),
  practiceId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
    }
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')
    const backendApiKey = process.env.EHR_BACKEND_API_KEY
    const isApiKeyAuth =
      backendApiKey && apiKey && (apiKey === backendApiKey || apiKey === `Bearer ${backendApiKey}`)
    if (isApiKeyAuth && !parsed.data.practiceId) {
      return NextResponse.json({ error: 'practiceId is required for API key auth' }, { status: 400 })
    }
    const { practiceId, user } = isApiKeyAuth
      ? { practiceId: parsed.data.practiceId!, user: { id: 'system' } }
      : await resolveEhrPractice(parsed.data.practiceId)
    const settings = await getEhrSettings(practiceId)
    if (!settings?.enabledProviders?.includes(parsed.data.providerId as any)) {
      return NextResponse.json({ error: 'Provider not enabled for tenant' }, { status: 403 })
    }

    const connections = await prisma.ehrConnection.findMany({
      where: {
        tenantId: practiceId,
        providerId: parsed.data.providerId,
        issuer: parsed.data.issuer || undefined,
      },
      orderBy: { updatedAt: 'desc' },
    })
    const expectedAuthFlow = parsed.data.providerId.startsWith('ecw_')
      ? 'backend_services'
      : 'smart_launch'
    const connection = connections.find((candidate) => candidate.authFlow === expectedAuthFlow)

    if (!connection) {
      return NextResponse.json({ connected: false })
    }

    let capabilitiesSummary = undefined
    if (parsed.data.includeCapabilities === '1') {
      if (!connection.accessTokenEnc) {
        return NextResponse.json({ error: 'Connection missing access token' }, { status: 409 })
      }
      try {
        const refreshedConnection = await refreshBackendConnectionIfNeeded({ connection })
        const tokenEndpoint = refreshedConnection.tokenEndpoint || undefined
        const privateKeyConfig = tokenEndpoint
          ? getPrivateKeyJwtConfig(refreshedConnection.providerId)
          : null
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
          clientAssertionProvider: privateKeyConfig && tokenEndpoint
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
              actorUserId: isApiKeyAuth ? null : user.id,
              action: 'EHR_TOKEN_REFRESH',
              providerId: connection.providerId,
              entity: 'EhrConnection',
              entityId: connection.id,
            })
          },
        })
        const capabilityStatement = await client.getCapabilityStatement()
        capabilitiesSummary = summarizeCapabilities(capabilityStatement)
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (message.includes('Token refresh failed') || message.includes('FHIR request failed: 401')) {
          await prisma.ehrConnection.update({
            where: { id: connection.id },
            data: { status: 'expired' },
          })
          await logEhrAudit({
            tenantId: practiceId,
            actorUserId: isApiKeyAuth ? null : user.id,
            action: 'EHR_TOKEN_EXPIRED',
            providerId: connection.providerId,
            entity: 'EhrConnection',
            entityId: connection.id,
          })
        }
        capabilitiesSummary = { error: 'Failed to fetch capability statement' }
      }
    }

    const connected = Boolean(connection.accessTokenEnc) && connection.status !== 'disconnected'
    return NextResponse.json({
      connected,
      status: connection.status,
      issuer: connection.issuer,
      fhirBaseUrl: connection.fhirBaseUrl,
      scopes: connection.scopesGranted,
      expiresAt: connection.expiresAt,
      idTokenClaimsSummary: connection.idTokenClaimsSummary,
      capabilitiesSummary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch status'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
