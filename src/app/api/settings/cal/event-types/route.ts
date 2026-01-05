import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import { calEventTypeMappingSchema } from '@/lib/validations'
import { getCalClient } from '@/lib/cal'

/**
 * Get event type mappings for the practice
 * If ?fetch=true, also fetches event types from Cal.com
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const searchParams = req.nextUrl.searchParams
    const shouldFetch = searchParams.get('fetch') === 'true'
    const queryPracticeId = searchParams.get('practiceId')

    // If practiceId is provided in query and user is Vantage Admin, use it
    let practiceId: string | null = user.practiceId
    if (queryPracticeId && isVantageAdmin(user)) {
      practiceId = queryPracticeId
    }

    if (!practiceId) {
      return NextResponse.json({ mappings: [] })
    }

    const mappings = await prisma.calEventTypeMapping.findMany({
      where: { practiceId: practiceId },
      include: {
        calIntegration: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    })

    // If fetch=true, also get event types from Cal.com
    if (shouldFetch) {
      if (!practiceId) {
        return NextResponse.json({ mappings })
      }
      try {
        const calClient = await getCalClient(practiceId)
        const eventTypes = await calClient.getEventTypes()
        return NextResponse.json({ mappings, eventTypes })
      } catch (error) {
        // If fetching event types fails, still return mappings
        console.error('Error fetching Cal.com event types:', error)
        return NextResponse.json({ 
          mappings, 
          eventTypes: [],
          error: 'Failed to fetch event types from Cal.com'
        })
      }
    }

    return NextResponse.json({ mappings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch event type mappings' },
      { status: 500 }
    )
  }
}

/**
 * Create event type mapping
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

    const validated = calEventTypeMappingSchema.parse(body)

    // Verify integration exists
    const integration = await prisma.calIntegration.findUnique({
      where: { practiceId: practiceId },
    })

    if (!integration) {
      return NextResponse.json({ error: 'Cal.com integration not configured' }, { status: 400 })
    }

    const mapping = await prisma.calEventTypeMapping.create({
      data: {
        practiceId: practiceId,
        calIntegrationId: integration.id,
        visitTypeName: validated.visitTypeName,
        calEventTypeId: validated.calEventTypeId,
      },
    })

    return NextResponse.json({ mapping }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create event type mapping' },
      { status: 500 }
    )
  }
}

