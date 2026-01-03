import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getRetellClient } from '@/lib/retell-api'

export const dynamic = 'force-dynamic'

/**
 * Test RetellAI API connection
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json(
        { success: false, message: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

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

