import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import { FhirClient } from '@/lib/integrations/fhir/fhirClient'
import { resolveEhrPractice, getEhrSettings, getPrivateKeyJwtConfig } from '@/lib/integrations/ehr/server'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import { getPatient, createPatient } from '@/lib/integrations/fhir/resources/patient'
import { createClientAssertion } from '@/lib/integrations/ehr/smartEngine'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'

const querySchema = z.object({
  providerId: z.string(),
  patientId: z.string().min(1),
  issuer: z.string().url().optional(),
  practiceId: z.string().optional(),
})

const createSchema = z.object({
  providerId: z.string(),
  issuer: z.string().url().optional(),
  practiceId: z.string().optional(),
  patient: z.object({
    name: z.object({
      given: z.array(z.string().min(1)).min(1),
      family: z.string().optional(),
      text: z.string().optional(),
    }),
    gender: z.string().min(1).optional(),
    birthDate: z.string().optional(),
    telecom: z
      .array(
        z.object({
          system: z.enum(['phone', 'email']),
          value: z.string().min(1),
          use: z.string().optional(),
        })
      )
      .optional(),
    identifiers: z
      .array(
        z.object({
          system: z.string().optional(),
          value: z.string().min(1),
        })
      )
      .optional(),
  }),
})

function isEcwProvider(providerId: string) {
  return providerId.startsWith('ecw')
}

export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing patientId' }, { status: 400 })
    }
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')
    const backendApiKey = process.env.EHR_BACKEND_API_KEY
    const isApiKeyAuth =
      backendApiKey &&
      apiKey &&
      (apiKey === backendApiKey || apiKey === `Bearer ${backendApiKey}`)
    if (isApiKeyAuth && !parsed.data.practiceId) {
      return NextResponse.json({ error: 'practiceId is required for API key auth' }, { status: 400 })
    }
    const authContext = isApiKeyAuth
      ? { practiceId: parsed.data.practiceId!, user: { id: 'system' } }
      : await resolveEhrPractice(parsed.data.practiceId)
    const { practiceId, user } = authContext
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
    const expectedAuthFlow = isApiKeyAuth ? 'backend_services' : 'smart_launch'
    const connection = connections.find((candidate) => candidate.authFlow === expectedAuthFlow)

    if (!connection?.accessTokenEnc) {
      if (connections.length > 0 && expectedAuthFlow === 'smart_launch') {
        return NextResponse.json(
          { error: 'SMART App Launch connection required. Use standalone connect.' },
          { status: 409 }
        )
      }
      if (expectedAuthFlow === 'backend_services') {
        return NextResponse.json(
          { error: 'No backend services connection. Use backend connect endpoint.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'No active EHR connection' }, { status: 404 })
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
        accessToken: decryptString(refreshedConnection.accessTokenEnc),
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

    let patient
    try {
      patient = await getPatient(client, parsed.data.patientId)
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
        return NextResponse.json(
          { error: 'EHR connection expired. Reconnect to continue.', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        )
      }
      throw error
    }

    await logEhrAudit({
      tenantId: practiceId,
      actorUserId: isApiKeyAuth ? null : user.id,
      action: 'FHIR_READ',
      providerId: connection.providerId,
      entity: 'Patient',
      entityId: parsed.data.patientId,
    })

    return NextResponse.json({ patient })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch patient'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')
    const backendApiKey = process.env.EHR_BACKEND_API_KEY
    const isApiKeyAuth =
      backendApiKey &&
      apiKey &&
      (apiKey === backendApiKey || apiKey === `Bearer ${backendApiKey}`)
    if (isApiKeyAuth && !parsed.data.practiceId) {
      return NextResponse.json({ error: 'practiceId is required for API key auth' }, { status: 400 })
    }
    const authContext = isApiKeyAuth
      ? { practiceId: parsed.data.practiceId!, user: { id: 'system' } }
      : await resolveEhrPractice(parsed.data.practiceId)
    const { practiceId, user } = authContext
    const settings = await getEhrSettings(practiceId)
    if (!settings?.enabledProviders?.includes(parsed.data.providerId as any)) {
      return NextResponse.json({ error: 'Provider not enabled for tenant' }, { status: 403 })
    }
    if (!settings?.enableWrite || !settings.enablePatientCreate) {
      return NextResponse.json(
        { error: 'Patient creation is disabled. Enable write access for this tenant.' },
        { status: 403 }
      )
    }

    const connections = await prisma.ehrConnection.findMany({
      where: {
        tenantId: practiceId,
        providerId: parsed.data.providerId,
        issuer: parsed.data.issuer || undefined,
      },
      orderBy: { updatedAt: 'desc' },
    })
    const expectedAuthFlow = isApiKeyAuth ? 'backend_services' : 'smart_launch'
    const connection = connections.find((candidate) => candidate.authFlow === expectedAuthFlow)

    if (!connection?.accessTokenEnc) {
      if (connections.length > 0 && expectedAuthFlow === 'smart_launch') {
        return NextResponse.json(
          { error: 'SMART App Launch connection required. Use standalone connect.' },
          { status: 409 }
        )
      }
      if (expectedAuthFlow === 'backend_services') {
        return NextResponse.json(
          { error: 'No backend services connection. Use backend connect endpoint.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'No active EHR connection' }, { status: 404 })
    }

    if (isEcwProvider(connection.providerId)) {
      const identifiers = parsed.data.patient.identifiers || []
      const hasIdentifier = identifiers.some((identifier) => identifier.value?.trim())
      if (!hasIdentifier || !parsed.data.patient.gender) {
        return NextResponse.json(
          { error: 'eCW patient create requires identifier and gender fields.' },
          { status: 400 }
        )
      }
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
        accessToken: decryptString(refreshedConnection.accessTokenEnc),
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
          actorUserId: isApiKeyAuth ? null : user.id,
          action: 'EHR_TOKEN_EXPIRED',
          providerId: connection.providerId,
          entity: 'EhrConnection',
          entityId: connection.id,
        })
        return NextResponse.json(
          { error: 'EHR connection expired. Reconnect to continue.', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        )
      }
      throw error
    }

    const created = await createPatient(
      client,
      {
        name: parsed.data.patient.name,
        gender: parsed.data.patient.gender,
        birthDate: parsed.data.patient.birthDate,
        telecom: parsed.data.patient.telecom,
        identifiers: parsed.data.patient.identifiers,
      },
      capabilityStatement
    )

    await logEhrAudit({
      tenantId: practiceId,
      actorUserId: isApiKeyAuth ? null : user.id,
      action: 'FHIR_WRITE',
      providerId: connection.providerId,
      entity: 'Patient',
      metadata: {
        issuer: connection.issuer,
      },
    })

    return NextResponse.json({ patient: created })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create patient'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
