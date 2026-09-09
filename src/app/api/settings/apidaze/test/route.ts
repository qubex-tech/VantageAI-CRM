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
    const numbers = await client.listPhoneNumbers()
    return NextResponse.json({
      success: true,
      numberCount: numbers.length,
      numbers: numbers.map((entry) => entry.phoneNumber),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Apidaze connection test failed' },
      { status: 500 }
    )
  }
}
