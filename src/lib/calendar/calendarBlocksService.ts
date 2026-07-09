import { prisma } from '@/lib/db'
import {
  expandCalendarBlocks,
  occurrenceDateToExceptionDate,
  zonedDateKey,
  zonedLocalToUtc,
} from '@/lib/calendar/expandCalendarBlocks'
import { loadCalendarBlockSeriesForRange } from '@/lib/calendar/blockingIntervals'
import type { CalendarBlockOccurrence, CalendarBlockSeries } from '@/lib/calendar/types'
import { WEEKDAY_CODES } from '@/lib/calendar/types'
import { getPracticeTimeZone } from '@/lib/practice-timezone'

function seriesFromRow(row: {
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

function defaultByDayFromStart(startTime: Date, timeZone: string): string[] {
  const key = zonedDateKey(startTime, timeZone)
  // Derive weekday via noon local to avoid DST edge
  const [y, m, d] = key.split('-').map(Number)
  const noon = zonedLocalToUtc(y, m, d, 12, 0, 0, timeZone)
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(noon)
  const map: Record<string, string> = {
    Sun: 'SU',
    Mon: 'MO',
    Tue: 'TU',
    Wed: 'WE',
    Thu: 'TH',
    Fri: 'FR',
    Sat: 'SA',
  }
  const code = map[weekday]
  return code && (WEEKDAY_CODES as readonly string[]).includes(code) ? [code] : ['MO']
}

export async function listCalendarBlockOccurrences(params: {
  practiceId: string
  from: Date
  to: Date
  providerId?: string | null
}): Promise<CalendarBlockOccurrence[]> {
  const series = await loadCalendarBlockSeriesForRange({
    practiceId: params.practiceId,
    start: params.from,
    end: params.to,
    providerId: params.providerId,
  })
  return expandCalendarBlocks(series, params.from, params.to)
}

export type CreateCalendarBlockInput = {
  practiceId: string
  createdById?: string | null
  providerId?: string | null
  kind: 'block' | 'meeting'
  title: string
  notes?: string | null
  startTime: Date
  endTime: Date
  timezone?: string
  recurrenceFrequency?: 'none' | 'daily' | 'weekly'
  recurrenceInterval?: number
  recurrenceByDay?: string[]
  recurrenceUntil?: Date | null
  recurrenceCount?: number | null
}

export async function createCalendarBlock(input: CreateCalendarBlockInput) {
  const timezone = input.timezone || (await getPracticeTimeZone(input.practiceId))
  const frequency = input.recurrenceFrequency ?? 'none'
  let byDay = input.recurrenceByDay ?? []
  if (frequency === 'weekly' && byDay.length === 0) {
    byDay = defaultByDayFromStart(input.startTime, timezone)
  }

  return prisma.calendarBlock.create({
    data: {
      practiceId: input.practiceId,
      providerId: input.providerId ?? null,
      kind: input.kind,
      title: input.title,
      notes: input.notes ?? null,
      startTime: input.startTime,
      endTime: input.endTime,
      timezone,
      recurrenceFrequency: frequency,
      recurrenceInterval: input.recurrenceInterval ?? 1,
      recurrenceByDay: frequency === 'weekly' ? byDay : [],
      recurrenceUntil: frequency === 'none' ? null : input.recurrenceUntil ?? null,
      recurrenceCount: frequency === 'none' ? null : input.recurrenceCount ?? null,
      createdById: input.createdById ?? null,
    },
  })
}

export async function updateCalendarBlockSeries(
  practiceId: string,
  blockId: string,
  data: Partial<CreateCalendarBlockInput>
) {
  const existing = await prisma.calendarBlock.findFirst({
    where: { id: blockId, practiceId },
  })
  if (!existing) return null

  const timezone = data.timezone ?? existing.timezone
  const frequency = data.recurrenceFrequency ?? existing.recurrenceFrequency
  let byDay = data.recurrenceByDay ?? existing.recurrenceByDay
  if (frequency === 'weekly' && byDay.length === 0) {
    byDay = defaultByDayFromStart(data.startTime ?? existing.startTime, timezone)
  }

  return prisma.calendarBlock.update({
    where: { id: blockId },
    data: {
      ...(data.providerId !== undefined ? { providerId: data.providerId } : {}),
      ...(data.kind !== undefined ? { kind: data.kind } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
      ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
      timezone,
      recurrenceFrequency: frequency,
      ...(data.recurrenceInterval !== undefined
        ? { recurrenceInterval: data.recurrenceInterval }
        : {}),
      recurrenceByDay: frequency === 'weekly' ? byDay : [],
      recurrenceUntil:
        frequency === 'none'
          ? null
          : data.recurrenceUntil !== undefined
            ? data.recurrenceUntil
            : existing.recurrenceUntil,
      recurrenceCount:
        frequency === 'none'
          ? null
          : data.recurrenceCount !== undefined
            ? data.recurrenceCount
            : existing.recurrenceCount,
    },
  })
}

/** Skip a single occurrence of a recurring series. */
export async function addOccurrenceException(
  practiceId: string,
  blockId: string,
  occurrenceDate: string
) {
  const existing = await prisma.calendarBlock.findFirst({
    where: { id: blockId, practiceId },
  })
  if (!existing) return null

  const exception = occurrenceDateToExceptionDate(occurrenceDate)
  const already = existing.exceptionDates.some((d) => d.getTime() === exception.getTime())
  if (already) return existing

  return prisma.calendarBlock.update({
    where: { id: blockId },
    data: {
      exceptionDates: [...existing.exceptionDates, exception],
    },
  })
}

/**
 * Edit a single occurrence: add exception on the series + create a one-off block.
 */
export async function splitOccurrenceToOneOff(
  practiceId: string,
  blockId: string,
  occurrenceDate: string,
  patch: Partial<CreateCalendarBlockInput>,
  createdById?: string | null
) {
  const existing = await prisma.calendarBlock.findFirst({
    where: { id: blockId, practiceId },
  })
  if (!existing) return null

  await addOccurrenceException(practiceId, blockId, occurrenceDate)

  const durationMs = existing.endTime.getTime() - existing.startTime.getTime()
  const series = seriesFromRow(existing)
  const dayStart = occurrenceDateToExceptionDate(occurrenceDate)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  const occurrences = expandCalendarBlocks([series], dayStart, dayEnd)
  const match = occurrences.find((o) => o.occurrenceDate === occurrenceDate)

  const startTime = patch.startTime ?? match?.startTime ?? existing.startTime
  const endTime =
    patch.endTime ??
    match?.endTime ??
    new Date(startTime.getTime() + durationMs)

  const oneOff = await createCalendarBlock({
    practiceId,
    createdById,
    providerId: patch.providerId !== undefined ? patch.providerId : existing.providerId,
    kind: (patch.kind as 'block' | 'meeting') ?? (existing.kind as 'block' | 'meeting'),
    title: patch.title ?? existing.title,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    startTime,
    endTime,
    timezone: patch.timezone ?? existing.timezone,
    recurrenceFrequency: 'none',
  })

  return { seriesId: blockId, oneOff }
}

export async function deleteCalendarBlockSeries(practiceId: string, blockId: string) {
  const existing = await prisma.calendarBlock.findFirst({
    where: { id: blockId, practiceId },
    select: { id: true },
  })
  if (!existing) return false
  await prisma.calendarBlock.delete({ where: { id: blockId } })
  return true
}
