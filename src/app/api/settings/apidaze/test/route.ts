import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getApidazePlatformClient, isApidazePlatformConfigured } from '@/lib/apidaze'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)

    if (!isApidazePlatformConfigured()) {
      return NextResponse.json(
        { error: 'Apidaze is not configured. Set APIDAZE_API_KEY and APIDAZE_API_SECRET on the server.' },
        { status: 400 }
      )
    }

    const client = getApidazePlatformClient()
    const validation = await client.testConnection()
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error || 'Apidaze credential validation failed' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Apidaze connection test failed' },
      { status: 500 }
    )
  }
}
