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
    const slots = await calClient.getAvailableSlots(
      validated.eventTypeId,
      validated.dateFrom,
      validated.dateTo,
      validated.timezone
    )

    return NextResponse.json({ slots })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch available slots' },
      { status: 500 }
    )
  }
}

