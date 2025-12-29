import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getRetellClient } from '@/lib/retell-api'

/**
 * Test RetellAI API connection
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    const retellClient = await getRetellClient(user.practiceId)
    
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

