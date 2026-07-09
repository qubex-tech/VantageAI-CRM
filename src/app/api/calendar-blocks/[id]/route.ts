import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { calendarBlockUpdateSchema } from '@/lib/validations'
import {
  addOccurrenceException,
  deleteCalendarBlockSeries,
  splitOccurrenceToOneOff,
  updateCalendarBlockSeries,
} from '@/lib/calendar/calendarBlocksService'
import { prisma } from '@/lib/db'

type RouteContext = { params: { id: string } }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const block = await prisma.calendarBlock.findFirst({
      where: { id: context.params.id, practiceId: user.practiceId },
    })
    if (!block) {
      return NextResponse.json({ error: 'Calendar block not found' }, { status: 404 })
    }
    return NextResponse.json({ block })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch calendar block'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const body = await req.json()
    const validated = calendarBlockUpdateSchema.parse(body)
    const scope = validated.scope ?? 'series'
    const { scope: _scope, occurrenceDate, ...patch } = validated

    if (scope === 'occurrence') {
      if (!occurrenceDate) {
        return NextResponse.json(
          { error: 'occurrenceDate is required when scope=occurrence' },
          { status: 400 }
        )
      }
      const result = await splitOccurrenceToOneOff(
        user.practiceId,
        context.params.id,
        occurrenceDate,
        {
          providerId: patch.providerId,
          kind: patch.kind,
          title: patch.title,
          notes: patch.notes,
          startTime: patch.startTime,
          endTime: patch.endTime,
          timezone: patch.timezone,
        },
        user.id
      )
      if (!result) {
        return NextResponse.json({ error: 'Calendar block not found' }, { status: 404 })
      }
      return NextResponse.json({ block: result.oneOff, seriesId: result.seriesId })
    }

    const block = await updateCalendarBlockSeries(user.practiceId, context.params.id, {
      providerId: patch.providerId,
      kind: patch.kind,
      title: patch.title,
      notes: patch.notes,
      startTime: patch.startTime,
      endTime: patch.endTime,
      timezone: patch.timezone,
      recurrenceFrequency: patch.recurrenceFrequency,
      recurrenceInterval: patch.recurrenceInterval,
      recurrenceByDay: patch.recurrenceByDay,
      recurrenceUntil: patch.recurrenceUntil,
      recurrenceCount: patch.recurrenceCount,
    })
    if (!block) {
      return NextResponse.json({ error: 'Calendar block not found' }, { status: 404 })
    }
    return NextResponse.json({ block })
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', details: error }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Failed to update calendar block'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const scope = req.nextUrl.searchParams.get('scope') || 'series'
    const occurrenceDate = req.nextUrl.searchParams.get('occurrenceDate')

    if (scope === 'occurrence') {
      if (!occurrenceDate) {
        return NextResponse.json(
          { error: 'occurrenceDate is required when scope=occurrence' },
          { status: 400 }
        )
      }
      const existing = await prisma.calendarBlock.findFirst({
        where: { id: context.params.id, practiceId: user.practiceId },
      })
      if (!existing) {
        return NextResponse.json({ error: 'Calendar block not found' }, { status: 404 })
      }

      if (existing.recurrenceFrequency === 'none') {
        await deleteCalendarBlockSeries(user.practiceId, context.params.id)
        return NextResponse.json({ success: true, deleted: 'series' })
      }

      await addOccurrenceException(user.practiceId, context.params.id, occurrenceDate)
      return NextResponse.json({ success: true, deleted: 'occurrence' })
    }

    const ok = await deleteCalendarBlockSeries(user.practiceId, context.params.id)
    if (!ok) {
      return NextResponse.json({ error: 'Calendar block not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, deleted: 'series' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete calendar block'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
