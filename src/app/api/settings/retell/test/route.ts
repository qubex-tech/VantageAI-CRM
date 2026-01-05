import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import { getRetellClient } from '@/lib/retell-api'

export const dynamic = 'force-dynamic'

/**
 * Test RetellAI API connection
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

    const retellClient = await getRetellClient(practiceId)
    
    // Try to list calls to test the connection
    await retellClient.listCalls({ limit: 1 })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection test failed' 
      },
      { status: 400 }
    )
  }
}

