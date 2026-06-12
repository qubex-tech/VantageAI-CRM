import { NextRequest, NextResponse } from 'next/server'
import { getOpenDentalConnection, sanitizeConnectionForResponse } from '@/lib/integrations/opendental/factory'
import { resolveOpenDentalPractice } from '@/lib/integrations/opendental/server'

export async function GET(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveOpenDentalPractice(practiceIdOverride)
    const connection = await getOpenDentalConnection(practiceId)
    if (!connection) {
      return NextResponse.json({
        connected: false,
        status: 'not_configured',
      })
    }
    return NextResponse.json({
      connected: connection.isActive && connection.status === 'connected',
      connection: sanitizeConnectionForResponse(connection),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get Open Dental status'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
