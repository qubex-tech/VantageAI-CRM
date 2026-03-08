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
  providerId: z.string().optional(),
  practiceId: z.string().optional(),
  scopes: z.string().optional(),
  issuer: z.string().url().optional(),
  clientId: z.string().min(3).optional(),
  clientSecret: z.string().min(4).optional(),
  debug: z.boolean().optional(),
})

function isEcwIssuer(issuer: string | undefined) {
  if (!issuer) return false
  const normalized = issuer.toLowerCase()
  return normalized.includes('ecwcloud.com') || normalized.includes('eclinicalworks.com')
}

function decodeJwtSegment(segment: string) {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4 || 4)) % 4, '=')
  const decoded = Buffer.from(padded, 'base64').toString('utf8')
  return JSON.parse(decoded) as Record<string, unknown>
}

function getDefaultBackendScopes(params: {
  provider: ReturnType<typeof getProvider>
  settings?: {
    enableWrite?: boolean
    enablePatientCreate?: boolean
    enableNoteCreate?: boolean
    enableBulkExport?: boolean
  }
}) {
  if (process.env.EHR_BACKEND_SCOPES) {
    return process.env.EHR_BACKEND_SCOPES
  }
  return params.provider.defaultScopes({
    enableWrite: params.settings?.enableWrite,
    enablePatientCreate: params.settings?.enablePatientCreate,
    enableNoteCreate: params.settings?.enableNoteCreate,
    enableBulkExport: params.settings?.enableBulkExport,
  })
}

export async function POST(req: NextRequest) {
  let debugInfo: Record<string, unknown> | null = null
  let debugRequested = false
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    debugRequested = Boolean(parsed.data.debug)
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')
    const backendApiKey = process.env.EHR_BACKEND_API_KEY
    const isApiKeyAuth =
      backendApiKey &&
      apiKey &&
      (apiKey === backendApiKey || apiKey === `Bearer ${backendApiKey}`)

    if (!parsed.data.practiceId && !isApiKeyAuth) {
      return NextResponse.json({ error: 'practiceId is required' }, { status: 400 })
    }
    if (isApiKeyAuth && !parsed.data.practiceId) {
      return NextResponse.json({ error: 'practiceId is required for API key auth' }, { status: 400 })
    }

    const authContext = isApiKeyAuth
      ? { practiceId: parsed.data.practiceId!, user: { id: 'system' } }
      : await resolveEhrPractice(parsed.data.practiceId)
    const { practiceId, user } = authContext
    const settings = await getEhrSettings(practiceId)
    const hasProviderId = Boolean(parsed.data.providerId)
    const hasDirectConfig = Boolean(parsed.data.issuer && parsed.data.clientId)
    if (!hasProviderId && !hasDirectConfig) {
      return NextResponse.json(
        { error: 'providerId or issuer+clientId is required' },
        { status: 400 }
      )
    }

    let providerId = parsed.data.providerId
    let config: Record<string, unknown> = {}
    let issuer = ''
    let authFlow = 'backend_services'
    let useProviderDefaults = false

    if (hasProviderId) {
      if (!settings?.enabledProviders?.includes(parsed.data.providerId as any)) {
        return NextResponse.json({ error: 'Provider not enabled for tenant' }, { status: 403 })
      }
      const provider = getProvider(parsed.data.providerId as any)
      const providerConfig = settings?.providerConfigs?.[provider.id]
      const configParse = provider.configSchema.safeParse(providerConfig || {})
      if (!configParse.success) {
        return NextResponse.json({ error: 'Provider config missing or invalid' }, { status: 400 })
      }
      config = configParse.data as Record<string, unknown>
      if ((config as any).authFlow !== 'backend_services') {
        return NextResponse.json(
          { error: 'Provider is configured for SMART App Launch. Switch auth flow to backend services.' },
          { status: 409 }
        )
      }
      providerId = provider.id
      issuer = String(config.issuer)
      useProviderDefaults = true
    } else {
      issuer = String(parsed.data.issuer)
      config = {
        issuer,
        clientId: parsed.data.clientId,
        clientSecret: parsed.data.clientSecret,
        authFlow: 'backend_services',
      }
      providerId = isEcwIssuer(issuer) ? 'ecw_write' : 'generic'
      if (!parsed.data.scopes) {
        return NextResponse.json(
          { error: 'scopes is required when providerId is not supplied' },
          { status: 400 }
        )
      }
    }
    const discovery = await discoverSmartConfiguration(issuer)

    const scopes =
      useProviderDefaults && parsed.data.providerId
        ? parsed.data.scopes ||
          getDefaultBackendScopes({
            provider: getProvider(parsed.data.providerId as any),
            settings: settings || undefined,
          })
        : parsed.data.scopes

    const privateKeyConfig = getPrivateKeyJwtConfig(String(providerId))
    const audOverride = String(providerId).startsWith('ecw') || isEcwIssuer(issuer)
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

    if (debugRequested && clientAssertion) {
      try {
        const [headerSegment, payloadSegment] = clientAssertion.split('.')
        const header = decodeJwtSegment(headerSegment)
        const payload = decodeJwtSegment(payloadSegment)
        debugInfo = {
          header,
          payload,
          issuer,
          tokenEndpoint: discovery.tokenEndpoint,
          audOverride: audOverride || null,
          scopes: scopes || null,
          clientId: String(config.clientId),
          providerId: providerId ? String(providerId) : null,
        }
      } catch (error) {
        debugInfo = {
          error: 'Failed to decode client assertion',
          message: error instanceof Error ? error.message : String(error),
        }
      }
    }
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
        tenantId_providerId_issuer_authFlow: {
          tenantId: practiceId,
          providerId: String(providerId),
          issuer: discovery.issuer,
          authFlow,
        },
      },
      update: {
        authFlow,
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
        providerId: String(providerId),
        authFlow,
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
      actorUserId: isApiKeyAuth ? null : user.id,
      action: 'EHR_CONNECT',
      providerId: String(providerId),
      entity: 'EhrConnection',
      entityId: connection.id,
      metadata: {
        issuer: connection.issuer,
        scopes: connection.scopesGranted,
        authMode: privateKeyConfig ? 'private_key_jwt' : 'client_secret',
        authContext: isApiKeyAuth ? 'api_key' : 'user_session',
      },
    })

    return NextResponse.json({
      connected: true,
      issuer: connection.issuer,
      scopes: connection.scopesGranted,
      expiresAt: connection.expiresAt,
      ...(debugRequested && debugInfo ? { debug: debugInfo } : {}),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backend connect failed'
    if (debugRequested && debugInfo) {
      return NextResponse.json({ error: message, debug: debugInfo }, { status: 500 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
