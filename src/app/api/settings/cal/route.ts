import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { calIntegrationSchema, calEventTypeMappingSchema } from '@/lib/validations'
import { getCalClient } from '@/lib/cal'
import { isVantageAdmin } from '@/lib/permissions'

/**
 * Get Cal.com integration settings
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

    const integration = await prisma.calIntegration.findUnique({
      where: { practiceId: practiceId },
      include: {
        eventTypeMappings: true,
      },
    })

    return NextResponse.json({ integration })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Cal.com settings' },
      { status: 500 }
    )
  }
}

/**
 * Create or update Cal.com integration
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

    const validated = calIntegrationSchema.parse(body)

    // Test connection
    const { CalApiClient } = await import('@/lib/cal')
    const testClient = new CalApiClient(validated.apiKey)
    const isValid = await testClient.testConnection()

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid API key or connection failed' }, { status: 400 })
    }

    // Create or update integration
    const integration = await prisma.calIntegration.upsert({
      where: { practiceId: practiceId },
      create: {
        practiceId: practiceId,
        apiKey: validated.apiKey,
        calOrganizationId: validated.calOrganizationId,
        calTeamId: validated.calTeamId,
        isActive: true,
      },
      update: {
        apiKey: validated.apiKey,
        calOrganizationId: validated.calOrganizationId,
        calTeamId: validated.calTeamId,
      },
      include: {
        eventTypeMappings: true,
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
      { error: error instanceof Error ? error.message : 'Failed to save Cal.com settings' },
      { status: 500 }
    )
  }
}

