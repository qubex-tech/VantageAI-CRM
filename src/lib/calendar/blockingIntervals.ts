import { prisma } from '@/lib/db'
import {
  expandCalendarBlocks,
  intervalsOverlapMs,
} from '@/lib/calendar/expandCalendarBlocks'
import type { BlockingInterval, CalendarBlockSeries } from '@/lib/calendar/types'

function toSeries(row: {
  id: string
  practiceId: string
  providerId: string | null
  kind: string
  title: string
  notes: string | null
  startTime: Date
  endTime: Date
  timezone: string
  recurrenceFrequency: string
  recurrenceInterval: number
  recurrenceByDay: string[]
  recurrenceUntil: Date | null
  recurrenceCount: number | null
  exceptionDates: Date[]
}): CalendarBlockSeries {
  return {
    id: row.id,
    practiceId: row.practiceId,
    providerId: row.providerId,
    kind: row.kind,
    title: row.title,
    notes: row.notes,
    startTime: row.startTime,
    endTime: row.endTime,
    timezone: row.timezone,
    recurrenceFrequency: row.recurrenceFrequency,
    recurrenceInterval: row.recurrenceInterval,
    recurrenceByDay: row.recurrenceByDay,
    recurrenceUntil: row.recurrenceUntil,
    recurrenceCount: row.recurrenceCount,
    exceptionDates: row.exceptionDates,
  }
}

/**
 * Load calendar block series that could produce occurrences in [start, end).
 * Includes open-ended recurring series and those whose until is still ahead.
 */
export async function loadCalendarBlockSeriesForRange(params: {
  practiceId: string
  start: Date
  end: Date
  providerId?: string | null
}): Promise<CalendarBlockSeries[]> {
  const { practiceId, start, end, providerId } = params

  const rows = await prisma.calendarBlock.findMany({
    where: {
      practiceId,
      AND: [
        {
          OR: [
            // One-off or first occurrence overlaps range
            {
              startTime: { lt: end },
              endTime: { gt: start },
            },
            // Recurring series that started before range end and has not ended before range start
            {
              recurrenceFrequency: { not: 'none' },
              startTime: { lt: end },
              OR: [{ recurrenceUntil: null }, { recurrenceUntil: { gte: start } }],
            },
          ],
        },
        providerId
          ? {
              OR: [{ providerId: null }, { providerId }],
            }
          : {},
      ],
    },
  })

  return rows.map(toSeries)
}

export async function getBlockingIntervals(params: {
  practiceId: string
  start: Date
  end: Date
  providerId?: string | null
}): Promise<BlockingInterval[]> {
  const series = await loadCalendarBlockSeriesForRange(params)
  const occurrences = expandCalendarBlocks(series, params.start, params.end)

  // When a specific provider is requested, practice-wide (null) blocks still apply.
  // When providerId is omitted, return all.
  return occurrences.map((o) => ({
    blockId: o.blockId,
    startTime: o.startTime,
    endTime: o.endTime,
    providerId: o.providerId,
    kind: o.kind,
    title: o.title,
  }))
}

export function slotOverlapsAnyInterval(
  slotStart: Date,
  slotEnd: Date,
  intervals: BlockingInterval[]
): boolean {
  return intervals.some((interval) =>
    intervalsOverlapMs(slotStart, slotEnd, interval.startTime, interval.endTime)
  )
}

/** True when any Vantage calendar block overlaps the given window. */
export async function slotOverlapsCalendarBlock(params: {
  practiceId: string
  slotStart: Date
  slotEnd: Date
  providerId?: string | null
}): Promise<boolean> {
  const intervals = await getBlockingIntervals({
    practiceId: params.practiceId,
    start: params.slotStart,
    end: params.slotEnd,
    providerId: params.providerId,
  })
  return slotOverlapsAnyInterval(params.slotStart, params.slotEnd, intervals)
}
