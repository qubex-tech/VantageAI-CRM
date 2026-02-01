import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { decryptJson, encryptString } from '@/lib/integrations/ehr/crypto'
import {
  assertNonce,
  decodeIdToken,
  exchangeAuthorizationCode,
  SmartLaunchContext,
} from '@/lib/integrations/ehr/smartEngine'
import { prisma } from '@/lib/db'
import { resolveEhrPractice, getEhrSettings } from '@/lib/integrations/ehr/server'
import { getProvider } from '@/lib/integrations/ehr/providers'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'

const querySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
})

function buildRedirectTarget() {
  return '/settings/integrations/ehr'
}

export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid callback parameters' }, { status: 400 })
    }
    if (parsed.data.error) {
      return NextResponse.json(
        { error: parsed.data.error_description || parsed.data.error },
        { status: 400 }
      )
    }
    if (!parsed.data.code || !parsed.data.state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
    }

    const cookie = req.cookies.get('ehr_oauth')?.value
    if (!cookie) {
      return NextResponse.json({ error: 'OAuth context missing' }, { status: 400 })
    }

    const context = decryptJson<SmartLaunchContext>(cookie)
    if (context.state !== parsed.data.state) {
      return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
    }

    const { practiceId, user } = await resolveEhrPractice(context.practiceId)
    if (context.practiceId !== practiceId) {
      return NextResponse.json({ error: 'Tenant mismatch' }, { status: 403 })
    }

    const settings = await getEhrSettings(practiceId)
    const provider = getProvider(context.providerId as any)
    const providerConfig = settings?.providerConfigs?.[provider.id]
    const configParse = provider.configSchema.safeParse(providerConfig || {})
    if (!configParse.success) {
      return NextResponse.json({ error: 'Provider config missing or invalid' }, { status: 400 })
    }
    const config = configParse.data

    const baseUrl = process.env.APP_BASE_URL
    if (!baseUrl) {
      return NextResponse.json({ error: 'APP_BASE_URL is not configured' }, { status: 500 })
    }
    const redirectUri = `${baseUrl.replace(/\/+$/g, '')}/api/integrations/ehr/callback`

    const tokenResponse = await exchangeAuthorizationCode({
      tokenEndpoint: context.tokenEndpoint,
      clientId: context.clientId,
      clientSecret: (config as any).clientSecret,
      code: parsed.data.code,
      redirectUri,
      codeVerifier: context.codeVerifier,
    })

    let idTokenPayload: Record<string, unknown> | null = null
    if (tokenResponse.id_token) {
      idTokenPayload = decodeIdToken(tokenResponse.id_token)
      assertNonce(idTokenPayload, context.nonce)
    }

    const patientId =
      tokenResponse.patient ||
      (idTokenPayload?.patient as string | undefined) ||
      undefined
    const encounterId = tokenResponse.encounter || (idTokenPayload?.encounter as string | undefined)
    const fhirUser = tokenResponse.fhirUser || (idTokenPayload?.fhirUser as string | undefined)

    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null

    const encryptedAccessToken = encryptString(tokenResponse.access_token)
    const encryptedRefreshToken = tokenResponse.refresh_token
      ? encryptString(tokenResponse.refresh_token)
      : null
    const encryptedClientSecret = (config as any).clientSecret
      ? encryptString(String((config as any).clientSecret))
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
          issuer: context.issuer,
        },
      },
      update: {
        fhirBaseUrl: context.fhirBaseUrl,
        authorizationEndpoint: context.authorizationEndpoint,
        tokenEndpoint: context.tokenEndpoint,
        revocationEndpoint: context.revocationEndpoint,
        clientId: context.clientId,
        clientSecretEnc: encryptedClientSecret,
        scopesRequested: context.scopes,
        scopesGranted: tokenResponse.scope || context.scopes,
        accessTokenEnc: encryptedAccessToken,
        refreshTokenEnc: encryptedRefreshToken,
        expiresAt,
        idTokenClaimsSummary:
          patientId || encounterId || fhirUser
            ? { patientId, encounterId, fhirUser }
            : Prisma.JsonNull,
        vendorConfig: vendorConfigJson,
        status: 'connected',
      },
      create: {
        tenantId: practiceId,
        providerId: provider.id,
        issuer: context.issuer,
        fhirBaseUrl: context.fhirBaseUrl,
        authorizationEndpoint: context.authorizationEndpoint,
        tokenEndpoint: context.tokenEndpoint,
        revocationEndpoint: context.revocationEndpoint,
        clientId: context.clientId,
        clientSecretEnc: encryptedClientSecret,
        scopesRequested: context.scopes,
        scopesGranted: tokenResponse.scope || context.scopes,
        accessTokenEnc: encryptedAccessToken,
        refreshTokenEnc: encryptedRefreshToken,
        expiresAt,
        idTokenClaimsSummary:
          patientId || encounterId || fhirUser
            ? { patientId, encounterId, fhirUser }
            : Prisma.JsonNull,
        vendorConfig: vendorConfigJson,
        status: 'connected',
      },
    })

    if (provider.postConnectHook) {
      await provider.postConnectHook({
        connectionId: connection.id,
        config,
      })
    }

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
      },
    })

    const response = NextResponse.redirect(buildRedirectTarget())
    response.cookies.set('ehr_oauth', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
      path: '/',
    })
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'EHR callback failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
