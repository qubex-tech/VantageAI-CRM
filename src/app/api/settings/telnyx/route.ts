import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import { telnyxIntegrationSchema } from '@/lib/validations'
import { TelnyxApiClient, isMaskedTelnyxApiKey, normalizeTelnyxApiKey } from '@/lib/telnyx'

export const dynamic = 'force-dynamic'

function resolvePracticeId(
  user: { practiceId: string | null; name?: string | null; id: string; email: string; role: string },
  queryPracticeId: string | null
): string | null {
  const normalizedUser = {
    ...user,
    name: user.name ?? null,
  }
  if (queryPracticeId && isVantageAdmin(normalizedUser)) {
    return queryPracticeId
  }
  return user.practiceId
}

function formatZodError(error: unknown) {
  if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
    const zodError = error as unknown as { issues: Array<{ path: (string | number)[]; message: string }> }
    return zodError.issues
      .map((issue) => {
        const path = issue.path.join('.')
        return `${path}: ${issue.message}`
      })
      .join(', ')
  }
  return null
}

/**
 * Get Telnyx integration settings
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = resolvePracticeId(user, req.nextUrl.searchParams.get('practiceId'))

    if (!practiceId) {
      return NextResponse.json({ integration: null })
    }

    try {
      const integration = await prisma.telnyxIntegration.findUnique({
        where: { practiceId },
      })
      if (!integration) {
        return NextResponse.json({ integration: null })
      }
      return NextResponse.json({
        integration: {
          ...integration,
          apiKey: '',
          apiKeyConfigured: Boolean(integration.apiKey),
        },
      })
    } catch (error) {
      console.error('Error fetching Telnyx integration (table may not exist):', error)
      return NextResponse.json({ integration: null })
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Telnyx settings' },
      { status: 500 }
    )
  }
}

/**
 * Create or update Telnyx integration
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = resolvePracticeId(user, req.nextUrl.searchParams.get('practiceId'))

    if (!practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validated = telnyxIntegrationSchema.parse(body)

    const existing = await prisma.telnyxIntegration.findUnique({
      where: { practiceId },
    })

    let apiKey = validated.apiKey
    if (!apiKey || isMaskedTelnyxApiKey(apiKey)) {
      apiKey = existing?.apiKey
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }
    apiKey = normalizeTelnyxApiKey(apiKey)

    const testClient = new TelnyxApiClient(
      apiKey,
      validated.fromNumber,
      validated.messagingProfileId || existing?.messagingProfileId || undefined
    )
    const validation = await testClient.validateCredentials()
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error || 'Invalid Telnyx credentials or connection failed' },
        { status: 400 }
      )
    }

    const numbers = await testClient.listPhoneNumbers()
    const selected = numbers.find((entry) => entry.phoneNumber === validated.fromNumber)
    if (!selected) {
      return NextResponse.json(
        { error: 'Selected phone number was not found in your Telnyx account' },
        { status: 400 }
      )
    }
    if (!selected.messagingReady) {
      return NextResponse.json(
        {
          error:
            'Selected phone number is not messaging-ready. Assign it to a messaging profile in Telnyx first.',
        },
        { status: 400 }
      )
    }

    const integration = await prisma.telnyxIntegration.upsert({
      where: { practiceId },
      create: {
        practiceId,
        apiKey,
        fromNumber: validated.fromNumber,
        phoneNumberId: validated.phoneNumberId || selected.id || null,
        messagingProfileId:
          validated.messagingProfileId || selected.messagingProfileId || null,
        webhookPublicKey: validated.webhookPublicKey || null,
        isActive: true,
      },
      update: {
        apiKey,
        fromNumber: validated.fromNumber,
        phoneNumberId: validated.phoneNumberId || selected.id || null,
        messagingProfileId:
          validated.messagingProfileId || selected.messagingProfileId || null,
        webhookPublicKey: validated.webhookPublicKey || null,
      },
    })

    return NextResponse.json({
      integration: {
        ...integration,
        apiKey: '',
        apiKeyConfigured: Boolean(integration.apiKey),
      },
    })
  } catch (error) {
    const zodMessage = formatZodError(error)
    if (zodMessage) {
      return NextResponse.json({ error: `Validation error: ${zodMessage}` }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save Telnyx settings' },
      { status: 500 }
    )
  }
}
