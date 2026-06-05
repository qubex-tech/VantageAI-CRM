import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import { telnyxCredentialsSchema } from '@/lib/validations'
import { TelnyxApiClient } from '@/lib/telnyx'

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
 * List Telnyx phone numbers for a practice integration or ad-hoc credentials.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = resolvePracticeId(user, req.nextUrl.searchParams.get('practiceId'))

    if (!practiceId) {
      return NextResponse.json({ phoneNumbers: [] })
    }

    const integration = await prisma.telnyxIntegration.findUnique({
      where: { practiceId },
    })
    if (!integration?.apiKey) {
      return NextResponse.json(
        { error: 'Telnyx API key is not configured for this practice' },
        { status: 400 }
      )
    }

    const client = new TelnyxApiClient(integration.apiKey, integration.fromNumber)
    const phoneNumbers = await client.listPhoneNumbers()
    return NextResponse.json({ phoneNumbers })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list Telnyx phone numbers' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    const body = await req.json()
    const validated = telnyxCredentialsSchema.parse(body)

    const client = new TelnyxApiClient(validated.apiKey)
    const isValid = await client.testConnection()
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Telnyx API key or connection failed' }, { status: 400 })
    }

    const phoneNumbers = await client.listPhoneNumbers()
    return NextResponse.json({ phoneNumbers })
  } catch (error) {
    const zodMessage = formatZodError(error)
    if (zodMessage) {
      return NextResponse.json({ error: `Validation error: ${zodMessage}` }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list Telnyx phone numbers' },
      { status: 500 }
    )
  }
}
