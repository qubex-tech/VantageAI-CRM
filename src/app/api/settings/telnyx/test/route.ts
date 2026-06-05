import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import { telnyxTestSchema } from '@/lib/validations'
import {
  TelnyxApiClient,
  isMaskedTelnyxApiKey,
  normalizeTelnyxApiKey,
} from '@/lib/telnyx'

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

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()
    const validated = telnyxTestSchema.parse(body)
    const practiceId = resolvePracticeId(
      user,
      req.nextUrl.searchParams.get('practiceId')
    )

    let apiKey = validated.apiKey
    let integration = practiceId
      ? await prisma.telnyxIntegration.findUnique({ where: { practiceId } })
      : null

    if (!apiKey || isMaskedTelnyxApiKey(apiKey)) {
      if (!practiceId) {
        return NextResponse.json({ error: 'API key is required' }, { status: 400 })
      }
      apiKey = integration?.apiKey
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    apiKey = normalizeTelnyxApiKey(apiKey)

    const fromNumber = validated.fromNumber || integration?.fromNumber || undefined
    const messagingProfileId =
      validated.messagingProfileId || integration?.messagingProfileId || undefined

    const client = new TelnyxApiClient(apiKey, fromNumber, messagingProfileId)

    const validation = await client.validateCredentials()
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error || 'Telnyx credential validation failed' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      usedStoredKey: !validated.apiKey,
    })
  } catch (error) {
    const zodMessage = formatZodError(error)
    if (zodMessage) {
      return NextResponse.json({ error: `Validation error: ${zodMessage}` }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Telnyx connection test failed' },
      { status: 500 }
    )
  }
}
