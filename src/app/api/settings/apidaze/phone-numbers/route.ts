import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getApidazePlatformClient, isApidazePlatformConfigured } from '@/lib/apidaze'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAuth(req)

    if (!isApidazePlatformConfigured()) {
      return NextResponse.json(
        { error: 'Apidaze is not configured. Set APIDAZE_API_KEY and APIDAZE_API_SECRET on the server.' },
        { status: 400 }
      )
    }

    const client = getApidazePlatformClient()
    const phoneNumbers = await client.listPhoneNumbers()
    return NextResponse.json({ phoneNumbers })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list Apidaze phone numbers' },
      { status: 500 }
    )
  }
}
