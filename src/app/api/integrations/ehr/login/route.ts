import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getProvider } from '@/lib/integrations/ehr/providers'
import { discoverSmartConfiguration } from '@/lib/integrations/ehr/discovery'
import { buildAuthorizationUrl, createLaunchContext } from '@/lib/integrations/ehr/smartEngine'
import { encryptJson } from '@/lib/integrations/ehr/crypto'
import { getEhrSettings, resolveEhrPractice, isIssuerAllowed } from '@/lib/integrations/ehr/server'

const querySchema = z.object({
  providerId: z.string(),
})

function buildRedirectUri() {
  const baseUrl = process.env.APP_BASE_URL
  if (!baseUrl) {
    throw new Error('APP_BASE_URL is not configured')
  }
  return `${baseUrl.replace(/\/+$/g, '')}/api/integrations/ehr/callback`
}

export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing providerId' }, { status: 400 })
    }

    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveEhrPractice(practiceIdOverride)
    const provider = getProvider(parsed.data.providerId as any)

    const settings = await getEhrSettings(practiceId)
    if (!settings?.enabledProviders?.includes(provider.id)) {
      return NextResponse.json({ error: 'Provider not enabled for tenant' }, { status: 403 })
    }
    const providerConfig = settings.providerConfigs?.[provider.id]
    const configParse = provider.configSchema.safeParse(providerConfig || {})
    if (!configParse.success) {
      return NextResponse.json({ error: 'Provider config missing or invalid' }, { status: 400 })
    }
    const config = configParse.data
    const issuer = String((config as any).issuer || '')
    if (!isIssuerAllowed(issuer)) {
      return NextResponse.json({ error: 'Issuer not allowed' }, { status: 403 })
    }

    const discovery = await discoverSmartConfiguration(issuer)
    const fhirBaseUrl = provider.buildFhirBaseUrl(config)
    const scopes = provider.defaultScopes({
      enableWrite: settings.enableWrite,
      enablePatientCreate: settings.enablePatientCreate,
      enableNoteCreate: settings.enableNoteCreate,
      enableBulkExport: settings.enableBulkExport,
    })

    const context = createLaunchContext({
      providerId: provider.id,
      issuer: discovery.issuer,
      fhirBaseUrl,
      clientId: String((config as any).clientId),
      clientSecret: (config as any).clientSecret,
      authorizationEndpoint: discovery.authorizationEndpoint,
      tokenEndpoint: discovery.tokenEndpoint,
      revocationEndpoint: discovery.revocationEndpoint,
      scopes,
      practiceId,
    })

    const redirectUri = buildRedirectUri()
    const authUrl = buildAuthorizationUrl({
      authorizationEndpoint: context.authorizationEndpoint,
      clientId: context.clientId,
      redirectUri,
      scopes: context.scopes,
      state: context.state,
      nonce: context.nonce,
      codeChallenge: context.codeChallenge,
      aud: context.fhirBaseUrl,
    })

    const response = NextResponse.redirect(authUrl)
    response.cookies.set('ehr_oauth', encryptJson(context), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60,
      path: '/',
    })
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'EHR login failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
