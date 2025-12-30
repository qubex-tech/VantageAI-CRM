import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getCalClient } from '@/lib/cal'

export const dynamic = 'force-dynamic'

/**
 * Test Cal.com API connection
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    const calClient = await getCalClient(user.practiceId)
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

