import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import { getCalClient } from '@/lib/cal'

export const dynamic = 'force-dynamic'

/**
 * Test Cal.com API connection
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
      return NextResponse.json(
        { success: false, message: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const calClient = await getCalClient(practiceId)
    const isValid = await calClient.testConnection()

    if (!isValid) {
      return NextResponse.json({ success: false, message: 'Connection test failed' }, { status: 400 })
    }

    // Try to fetch event types
    const eventTypes = await calClient.getEventTypes()

    return NextResponse.json({ success: true, eventTypes })
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection test failed' 
      },
      { status: 500 }
    )
  }
}

