import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import { twilioIntegrationSchema } from '@/lib/validations'
import { TwilioApiClient } from '@/lib/twilio'

export const dynamic = 'force-dynamic'

/**
 * Get Twilio integration settings
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const searchParams = req.nextUrl.searchParams
    const queryPracticeId = searchParams.get('practiceId')

    // Normalize user object for type compatibility
    const normalizedUser = {
      ...user,
      name: user.name ?? null,
    }

    // If practiceId is provided in query and user is Vantage Admin, use it
    let practiceId: string | null = user.practiceId
    if (queryPracticeId && isVantageAdmin(normalizedUser)) {
      practiceId = queryPracticeId
    }

    if (!practiceId) {
      return NextResponse.json({ integration: null })
    }

    try {
      const integration = await prisma.twilioIntegration.findUnique({
        where: { practiceId: practiceId },
      })
      return NextResponse.json({ integration })
    } catch (error) {
      console.error('Error fetching Twilio integration (table may not exist):', error)
      return NextResponse.json({ integration: null })
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Twilio settings' },
      { status: 500 }
    )
  }
}

/**
 * Create or update Twilio integration
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()
    const searchParams = req.nextUrl.searchParams
    const queryPracticeId = searchParams.get('practiceId')

    // Normalize user object for type compatibility
    const normalizedUser = {
      ...user,
      name: user.name ?? null,
    }

    // If practiceId is provided in query and user is Vantage Admin, use it
    let practiceId: string | null = user.practiceId
    if (queryPracticeId && isVantageAdmin(normalizedUser)) {
      practiceId = queryPracticeId
    }

    if (!practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const validated = twilioIntegrationSchema.parse(body)

    // Test connection
    const testClient = new TwilioApiClient(
      validated.accountSid,
      validated.authToken,
      validated.messagingServiceSid || undefined,
      validated.fromNumber || undefined
    )
    const isValid = await testClient.testConnection()
    const serviceValid = await testClient.testMessagingService()

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Twilio credentials or connection failed' }, { status: 400 })
    }

    if (!serviceValid) {
      return NextResponse.json({ error: 'Invalid Twilio Messaging Service SID' }, { status: 400 })
    }

    // Create or update integration
    const integration = await prisma.twilioIntegration.upsert({
      where: { practiceId: practiceId },
      create: {
        practiceId: practiceId,
        accountSid: validated.accountSid,
        authToken: validated.authToken,
        messagingServiceSid: validated.messagingServiceSid || null,
        fromNumber: validated.fromNumber || null,
        isActive: true,
      },
      update: {
        accountSid: validated.accountSid,
        authToken: validated.authToken,
        messagingServiceSid: validated.messagingServiceSid || null,
        fromNumber: validated.fromNumber || null,
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
      { error: error instanceof Error ? error.message : 'Failed to save Twilio settings' },
      { status: 500 }
    )
  }
}
