import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getEhrSettings, getPrivateKeyJwtConfig } from '@/lib/integrations/ehr/server'
import { getProvider } from '@/lib/integrations/ehr/providers'
import { discoverSmartConfiguration } from '@/lib/integrations/ehr/discovery'
import { createClientAssertion, exchangeClientCredentials } from '@/lib/integrations/ehr/smartEngine'

const bodySchema = z.object({
  providerId: z.string().optional(),
  practiceId: z.string().optional(),
  scopes: z.string().optional(),
  issuer: z.string().url().optional(),
  clientId: z.string().min(3).optional(),
})

function isEcwIssuer(issuer: string | undefined) {
  if (!issuer) return false
  const normalized = issuer.toLowerCase()
  return normalized.includes('ecwcloud.com') || normalized.includes('eclinicalworks.com')
}

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')
    const backendApiKey = process.env.EHR_BACKEND_API_KEY
    const normalizeKey = (value: string | null | undefined) =>
      value ? value.trim() : value
    const isApiKeyAuth =
      normalizeKey(backendApiKey) &&
      normalizeKey(apiKey) &&
      (normalizeKey(apiKey) === normalizeKey(backendApiKey) ||
        normalizeKey(apiKey) === `Bearer ${normalizeKey(backendApiKey)}`)
    if (!isApiKeyAuth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!parsed.data.practiceId) {
      return NextResponse.json({ error: 'practiceId is required for API key auth' }, { status: 400 })
    }

    const practiceId = parsed.data.practiceId
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
    let issuer = ''
    let clientId = ''
    let scopes = parsed.data.scopes

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
      const config = configParse.data as Record<string, unknown>
      if ((config as any).authFlow !== 'backend_services') {
        return NextResponse.json(
          { error: 'Provider is configured for SMART App Launch. Switch auth flow to backend services.' },
          { status: 409 }
        )
      }
      providerId = provider.id
      issuer = String(config.issuer)
      clientId = String(config.clientId)
      if (!scopes) {
        scopes = provider.defaultScopes({
          enableWrite: settings?.enableWrite,
          enablePatientCreate: settings?.enablePatientCreate,
          enableNoteCreate: settings?.enableNoteCreate,
          enableBulkExport: settings?.enableBulkExport,
        })
      }
    } else {
      issuer = String(parsed.data.issuer)
      clientId = String(parsed.data.clientId)
      providerId = isEcwIssuer(issuer) ? 'ecw_write' : 'generic'
      if (!scopes) {
        return NextResponse.json(
          { error: 'scopes is required when providerId is not supplied' },
          { status: 400 }
        )
      }
    }

    const discovery = await discoverSmartConfiguration(issuer)
    const privateKeyConfig = getPrivateKeyJwtConfig(String(providerId))
    const audOverride = String(providerId).startsWith('ecw') || isEcwIssuer(issuer)
      ? process.env.EHR_ECW_CLIENT_ASSERTION_AUD || undefined
      : undefined
    const clientAssertion = privateKeyConfig
      ? createClientAssertion({
          clientId,
          tokenEndpoint: discovery.tokenEndpoint,
          privateKeyPem: privateKeyConfig.privateKeyPem,
          keyId: privateKeyConfig.keyId,
          audience: audOverride,
        })
      : undefined

    const tokenResponse = await exchangeClientCredentials({
      tokenEndpoint: discovery.tokenEndpoint,
      clientId,
      clientAssertion,
      scopes,
    })

    return NextResponse.json({
      access_token: tokenResponse.access_token,
      token_type: tokenResponse.token_type || 'Bearer',
      expires_in: tokenResponse.expires_in,
      scope: tokenResponse.scope || scopes,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
