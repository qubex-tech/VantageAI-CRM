import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { calendarBlockSchema } from '@/lib/validations'
import {
  createCalendarBlock,
  listCalendarBlockOccurrences,
} from '@/lib/calendar/calendarBlocksService'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const fromParam = req.nextUrl.searchParams.get('from')
    const toParam = req.nextUrl.searchParams.get('to')
    const providerId = req.nextUrl.searchParams.get('providerId')

    if (!fromParam || !toParam) {
      return NextResponse.json(
        { error: 'from and to query params are required (ISO dates)' },
        { status: 400 }
      )
    }

    const from = new Date(fromParam)
    const to = new Date(toParam)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return NextResponse.json({ error: 'Invalid from/to range' }, { status: 400 })
    }

    const occurrences = await listCalendarBlockOccurrences({
      practiceId: user.practiceId,
      from,
      to,
      providerId: providerId || undefined,
    })

    return NextResponse.json({
      blocks: occurrences.map((o) => ({
        ...o,
        startTime: o.startTime.toISOString(),
        endTime: o.endTime.toISOString(),
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch calendar blocks'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const body = await req.json()
    const validated = calendarBlockSchema.parse(body)

    const block = await createCalendarBlock({
      practiceId: user.practiceId,
      createdById: user.id,
      providerId: validated.providerId,
      kind: validated.kind,
      title: validated.title,
      notes: validated.notes,
      startTime: validated.startTime,
      endTime: validated.endTime,
      timezone: validated.timezone,
      recurrenceFrequency: validated.recurrenceFrequency,
      recurrenceInterval: validated.recurrenceInterval,
      recurrenceByDay: validated.recurrenceByDay,
      recurrenceUntil: validated.recurrenceUntil,
      recurrenceCount: validated.recurrenceCount,
    })

    return NextResponse.json({ block }, { status: 201 })
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', details: error }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Failed to create calendar block'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
