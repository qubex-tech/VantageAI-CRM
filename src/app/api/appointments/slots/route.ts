import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getCalClient } from '@/lib/cal'
import { getAvailableSlotsSchema } from '@/lib/validations'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const searchParams = req.nextUrl.searchParams

    const params = {
      eventTypeId: searchParams.get('eventTypeId') || '',
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
      timezone: searchParams.get('timezone') || 'America/New_York',
    }

    const validated = getAvailableSlotsSchema.parse(params)

    const calClient = await getCalClient(user.practiceId)
    
    try {
      const slots = await calClient.getAvailableSlots(
        validated.eventTypeId,
        validated.dateFrom,
        validated.dateTo,
        validated.timezone
      )
      return NextResponse.json({ slots })
    } catch (error) {
      // If slots endpoint fails (e.g., v2 API key with v1 endpoint), return empty array
      // This allows the UI to show manual time input instead
      console.warn('Failed to fetch slots, returning empty array:', error)
      return NextResponse.json({ slots: [] })
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch available slots' },
      { status: 500 }
    )
  }
}

