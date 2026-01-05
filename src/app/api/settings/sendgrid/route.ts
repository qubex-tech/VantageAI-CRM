import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import { sendgridIntegrationSchema } from '@/lib/validations'
import { SendgridApiClient } from '@/lib/sendgrid'

export const dynamic = 'force-dynamic'

/**
 * Get SendGrid integration settings
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const searchParams = req.nextUrl.searchParams
    const queryPracticeId = searchParams.get('practiceId')

    // If practiceId is provided in query and user is Vantage Admin, use it
    let practiceId: string | null = user.practiceId
    if (queryPracticeId && isVantageAdmin(user)) {
      practiceId = queryPracticeId
    }

    if (!practiceId) {
      return NextResponse.json({ integration: null })
    }

    const integration = await prisma.sendgridIntegration.findUnique({
      where: { practiceId: practiceId },
    })

    return NextResponse.json({ integration })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch SendGrid settings' },
      { status: 500 }
    )
  }
}

/**
 * Create or update SendGrid integration
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()
    const searchParams = req.nextUrl.searchParams
    const queryPracticeId = searchParams.get('practiceId')

    // If practiceId is provided in query and user is Vantage Admin, use it
    let practiceId: string | null = user.practiceId
    if (queryPracticeId && isVantageAdmin(user)) {
      practiceId = queryPracticeId
    }

    if (!practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const validated = sendgridIntegrationSchema.parse(body)

    // Test connection
    const testClient = new SendgridApiClient(
      validated.apiKey,
      validated.fromEmail,
      validated.fromName || undefined
    )
    const isValid = await testClient.testConnection()

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid API key or connection failed' }, { status: 400 })
    }

    // Create or update integration
    const integration = await prisma.sendgridIntegration.upsert({
      where: { practiceId: practiceId },
      create: {
        practiceId: practiceId,
        apiKey: validated.apiKey,
        fromEmail: validated.fromEmail,
        fromName: validated.fromName || null,
        isActive: true,
      },
      update: {
        apiKey: validated.apiKey,
        fromEmail: validated.fromEmail,
        fromName: validated.fromName || null,
      },
    })

    return NextResponse.json({ integration })
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      const zodError = error as unknown as { issues: Array<{ path: (string | number)[]; message: string }> }
      const errorMessage = zodError.issues.map(issue => {
        const path = issue.path.join('.')
        return `${path}: ${issue.message}`
      }).join(', ')
      return NextResponse.json({ error: `Validation error: ${errorMessage}` }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save SendGrid settings' },
      { status: 500 }
    )
  }
}

