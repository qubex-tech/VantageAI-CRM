import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import { discoverSmartConfiguration } from '@/lib/integrations/ehr/discovery'
import { getProvider } from '@/lib/integrations/ehr/providers'
import { resolveEhrPractice, getEhrSettings, getPrivateKeyJwtConfig } from '@/lib/integrations/ehr/server'
import { createClientAssertion, exchangeClientCredentials } from '@/lib/integrations/ehr/smartEngine'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'

const bodySchema = z.object({
  providerId: z.string(),
  practiceId: z.string().optional(),
  scopes: z.string().optional(),
})

function getDefaultBackendScopes() {
  return process.env.EHR_BACKEND_SCOPES || 'system/Patient.read system/DocumentReference.read'
}

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const { practiceId, user } = await resolveEhrPractice(parsed.data.practiceId)
    const settings = await getEhrSettings(practiceId)
    if (!settings?.enabledProviders?.includes(parsed.data.providerId as any)) {
      return NextResponse.json({ error: 'Provider not enabled for tenant' }, { status: 403 })
    }

    const provider = getProvider(parsed.data.providerId as any)
    const providerConfig = settings?.providerConfigs?.[provider.id]
    const configParse = provider.configSchema.safeParse(providerConfig || {})
    if (!configParse.success) {
      return NextResponse.json({ error: 'Provider config missing or invalid' }, { status: 400 })
    }
    const config = configParse.data as Record<string, unknown>
    const issuer = String(config.issuer)
    const discovery = await discoverSmartConfiguration(issuer)

    const privateKeyConfig = getPrivateKeyJwtConfig(provider.id)
    const audOverride =
      provider.id === 'ecw'
        ? process.env.EHR_ECW_CLIENT_ASSERTION_AUD || undefined
        : undefined
    const clientAssertion = privateKeyConfig
      ? createClientAssertion({
          clientId: String(config.clientId),
          tokenEndpoint: discovery.tokenEndpoint,
          privateKeyPem: privateKeyConfig.privateKeyPem,
          keyId: privateKeyConfig.keyId,
          audience: audOverride,
        })
      : undefined

    const scopes = parsed.data.scopes || getDefaultBackendScopes()
    const tokenResponse = await exchangeClientCredentials({
      tokenEndpoint: discovery.tokenEndpoint,
      clientId: String(config.clientId),
      clientSecret: privateKeyConfig ? undefined : (config.clientSecret as string | undefined),
      clientAssertion,
      scopes,
    })

    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null
    const encryptedAccessToken = encryptString(tokenResponse.access_token)
    const encryptedRefreshToken = tokenResponse.refresh_token
      ? encryptString(tokenResponse.refresh_token)
      : null
    const encryptedClientSecret = config.clientSecret
      ? encryptString(String(config.clientSecret))
      : null
    const vendorConfig = { ...config } as Record<string, unknown>
    delete (vendorConfig as any).clientSecret
    const vendorConfigJson = Object.keys(vendorConfig).length
      ? (vendorConfig as Prisma.InputJsonValue)
      : Prisma.JsonNull

    const connection = await prisma.ehrConnection.upsert({
      where: {
        tenantId_providerId_issuer: {
          tenantId: practiceId,
          providerId: provider.id,
          issuer: discovery.issuer,
        },
      },
      update: {
        fhirBaseUrl: discovery.fhirBaseUrl,
        authorizationEndpoint: discovery.authorizationEndpoint,
        tokenEndpoint: discovery.tokenEndpoint,
        revocationEndpoint: discovery.revocationEndpoint,
        clientId: String(config.clientId),
        clientSecretEnc: encryptedClientSecret,
        scopesRequested: scopes,
        scopesGranted: tokenResponse.scope || scopes,
        accessTokenEnc: encryptedAccessToken,
        refreshTokenEnc: encryptedRefreshToken,
        expiresAt,
        vendorConfig: vendorConfigJson,
        status: 'connected',
      },
      create: {
        tenantId: practiceId,
        providerId: provider.id,
        issuer: discovery.issuer,
        fhirBaseUrl: discovery.fhirBaseUrl,
        authorizationEndpoint: discovery.authorizationEndpoint,
        tokenEndpoint: discovery.tokenEndpoint,
        revocationEndpoint: discovery.revocationEndpoint,
        clientId: String(config.clientId),
        clientSecretEnc: encryptedClientSecret,
        scopesRequested: scopes,
        scopesGranted: tokenResponse.scope || scopes,
        accessTokenEnc: encryptedAccessToken,
        refreshTokenEnc: encryptedRefreshToken,
        expiresAt,
        vendorConfig: vendorConfigJson,
        status: 'connected',
      },
    })

    await logEhrAudit({
      tenantId: practiceId,
      actorUserId: user.id,
      action: 'EHR_CONNECT',
      providerId: provider.id,
      entity: 'EhrConnection',
      entityId: connection.id,
      metadata: {
        issuer: connection.issuer,
        scopes: connection.scopesGranted,
        authMode: privateKeyConfig ? 'private_key_jwt' : 'client_secret',
      },
    })

    return NextResponse.json({
      connected: true,
      issuer: connection.issuer,
      scopes: connection.scopesGranted,
      expiresAt: connection.expiresAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backend connect failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
