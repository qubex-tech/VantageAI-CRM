import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { decryptJson, encryptString } from '@/lib/integrations/smart/crypto'
import {
  assertNonce,
  decodeIdToken,
  exchangeAuthorizationCode,
  SmartLaunchContext,
} from '@/lib/integrations/smart/smartClient'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { requireSmartUser } from '@/lib/integrations/smart/server'

const querySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
})

function buildRedirectTarget() {
  return '/settings/integrations/ecw-smart-fhir'
}

export async function GET(req: NextRequest) {
  try {
    const { user, practiceId } = await requireSmartUser()
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

    const cookie = req.cookies.get('smart_fhir_oauth')?.value
    if (!cookie) {
      return NextResponse.json({ error: 'OAuth context missing' }, { status: 400 })
    }

    const context = decryptJson<SmartLaunchContext>(cookie)
    if (context.state !== parsed.data.state) {
      return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
    }

    if (context.practiceId !== practiceId) {
      return NextResponse.json({ error: 'Tenant mismatch' }, { status: 403 })
    }

    const baseUrl = process.env.APP_BASE_URL
    if (!baseUrl) {
      return NextResponse.json({ error: 'APP_BASE_URL is not configured' }, { status: 500 })
    }
    const redirectUri = `${baseUrl.replace(/\/+$/g, '')}/api/integrations/smart/callback`
    const tokenResponse = await exchangeAuthorizationCode({
      tokenEndpoint: context.tokenEndpoint,
      clientId: context.clientId,
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
    const encryptedIdToken = tokenResponse.id_token ? encryptString(tokenResponse.id_token) : null

    const connection = await prisma.smartFhirConnection.upsert({
      where: {
        practiceId_issuer: {
          practiceId,
          issuer: context.issuer,
        },
      },
      update: {
        fhirBaseUrl: context.fhirBaseUrl,
        clientId: context.clientId,
        scopes: tokenResponse.scope || context.scopes,
        accessTokenEnc: encryptedAccessToken,
        refreshTokenEnc: encryptedRefreshToken,
        idTokenEnc: encryptedIdToken,
        tokenType: tokenResponse.token_type,
        expiresAt,
        patientContext: patientId || encounterId ? { patientId, encounterId } : Prisma.JsonNull,
        userContext: fhirUser ? { fhirUser } : Prisma.JsonNull,
        authorizationEndpoint: context.authorizationEndpoint,
        tokenEndpoint: context.tokenEndpoint,
        revocationEndpoint: context.revocationEndpoint,
        status: 'connected',
        lastConnectedAt: new Date(),
      },
      create: {
        practiceId,
        issuer: context.issuer,
        fhirBaseUrl: context.fhirBaseUrl,
        clientId: context.clientId,
        scopes: tokenResponse.scope || context.scopes,
        accessTokenEnc: encryptedAccessToken,
        refreshTokenEnc: encryptedRefreshToken,
        idTokenEnc: encryptedIdToken,
        tokenType: tokenResponse.token_type,
        expiresAt,
        patientContext: patientId || encounterId ? { patientId, encounterId } : Prisma.JsonNull,
        userContext: fhirUser ? { fhirUser } : Prisma.JsonNull,
        authorizationEndpoint: context.authorizationEndpoint,
        tokenEndpoint: context.tokenEndpoint,
        revocationEndpoint: context.revocationEndpoint,
        status: 'connected',
        lastConnectedAt: new Date(),
      },
    })

    await prisma.integrationAuditLog.create({
      data: {
        tenantId: practiceId,
        actorUserId: user.id,
        action: 'SMART_CONNECT',
        entity: 'SmartFhirConnection',
        entityId: connection.id,
        metadata: {
          issuer: connection.issuer,
          scopes: connection.scopes,
        },
      },
    })

    const response = NextResponse.redirect(buildRedirectTarget())
    response.cookies.set('smart_fhir_oauth', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
      path: '/',
    })
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SMART callback failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
