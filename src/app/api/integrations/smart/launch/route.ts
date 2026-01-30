import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { discoverSmartConfiguration } from '@/lib/integrations/smart/discovery'
import { buildAuthorizationUrl, createLaunchContext } from '@/lib/integrations/smart/smartClient'
import { encryptJson } from '@/lib/integrations/smart/crypto'
import { getSmartDefaultScopes, getSmartSettings, isIssuerAllowed, requireSmartUser, shouldEnableWrite } from '@/lib/integrations/smart/server'

const querySchema = z.object({
  iss: z.string().url(),
  launch: z.string().min(1),
  fhirBaseUrl: z.string().url().optional(),
})

function buildRedirectUri() {
  const baseUrl = process.env.APP_BASE_URL
  if (!baseUrl) {
    throw new Error('APP_BASE_URL is not configured')
  }
  return `${baseUrl.replace(/\/+$/g, '')}/api/integrations/smart/callback`
}

function buildScopes(settings: Awaited<ReturnType<typeof getSmartSettings>>) {
  const scopes = new Set(getSmartDefaultScopes().split(/\s+/).filter(Boolean))
  if (shouldEnableWrite(settings)) {
    if (settings?.enablePatientCreate) {
      scopes.add('patient/Patient.write')
    }
    if (settings?.enableNoteCreate) {
      scopes.add('patient/DocumentReference.write')
    }
  }
  return Array.from(scopes).join(' ')
}

export async function GET(req: NextRequest) {
  try {
    const { practiceId } = await requireSmartUser()
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing iss or launch parameter' }, { status: 400 })
    }

    if (!isIssuerAllowed(parsed.data.iss)) {
      return NextResponse.json({ error: 'Issuer not allowed' }, { status: 403 })
    }

    const settings = await getSmartSettings(practiceId)
    if (settings && settings.enabled === false) {
      return NextResponse.json({ error: 'SMART integration disabled for tenant' }, { status: 403 })
    }
    const clientId = settings?.clientId
    if (!clientId) {
      return NextResponse.json(
        { error: 'ClientId must be configured for EHR launch' },
        { status: 400 }
      )
    }

    const discovery = await discoverSmartConfiguration(parsed.data.iss)
    const fhirBaseUrl = (parsed.data.fhirBaseUrl || settings?.fhirBaseUrl || discovery.fhirBaseUrl).replace(/\/+$/g, '')
    const scopes = buildScopes(settings)

    const context = createLaunchContext({
      issuer: discovery.issuer,
      fhirBaseUrl,
      clientId,
      authorizationEndpoint: discovery.authorizationEndpoint,
      tokenEndpoint: discovery.tokenEndpoint,
      revocationEndpoint: discovery.revocationEndpoint,
      scopes,
      practiceId,
      launch: parsed.data.launch,
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
      launch: context.launch,
    })

    const response = NextResponse.redirect(authUrl)
    response.cookies.set('smart_fhir_oauth', encryptJson(context), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60,
      path: '/',
    })
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SMART launch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
