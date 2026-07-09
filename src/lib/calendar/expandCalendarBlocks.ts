import type {
  CalendarBlockOccurrence,
  CalendarBlockSeries,
  RecurrenceFrequency,
  WeekdayCode,
} from '@/lib/calendar/types'
import { WEEKDAY_CODES } from '@/lib/calendar/types'

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000
const MAX_OCCURRENCES_PER_SERIES = 400

const WEEKDAY_TO_INDEX: Record<WeekdayCode, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local YYYY-MM-DD for an instant in an IANA timezone. */
export function zonedDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  if (!year || !month || !day) {
    throw new Error(`Unable to format date in timezone ${timeZone}`)
  }
  return `${year}-${month}-${day}`
}

function zonedWeekdayIndex(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(date)
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[weekday] ?? 0
}

function zonedTimeParts(
  date: Date,
  timeZone: string
): { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? 0),
    second: Number(parts.find((p) => p.type === 'second')?.value ?? 0),
  }
}

/**
 * Convert a local civil datetime in `timeZone` to a UTC Date.
 */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const asLocal = new Date(utcGuess.toLocaleString('en-US', { timeZone }))
  const offset = utcGuess.getTime() - asLocal.getTime()
  let result = new Date(utcGuess.getTime() + offset)

  const check = new Date(result.toLocaleString('en-US', { timeZone }))
  const desired = new Date(year, month - 1, day, hour, minute, second)
  const drift = desired.getTime() - check.getTime()
  if (drift !== 0) {
    result = new Date(result.getTime() + drift)
  }
  return result
}

function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number)
  return { year, month, day }
}

function addDaysToDateKey(key: string, days: number): string {
  const { year, month, day } = parseDateKey(key)
  const d = new Date(Date.UTC(year, month - 1, day + days))
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

function compareDateKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function daysBetweenKeys(a: string, b: string): number {
  const pa = parseDateKey(a)
  const pb = parseDateKey(b)
  return (
    (Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) /
    (24 * 60 * 60 * 1000)
  )
}

function normalizeByDay(byDay: string[]): Set<number> {
  const set = new Set<number>()
  for (const code of byDay) {
    const upper = code.toUpperCase() as WeekdayCode
    if (WEEKDAY_CODES.includes(upper)) {
      set.add(WEEKDAY_TO_INDEX[upper])
    }
  }
  return set
}

function exceptionKeySet(exceptionDates: Date[], timeZone: string): Set<string> {
  const set = new Set<string>()
  for (const d of exceptionDates) {
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    if (
      d.getUTCHours() === 0 &&
      d.getUTCMinutes() === 0 &&
      d.getUTCSeconds() === 0 &&
      d.getUTCMilliseconds() === 0
    ) {
      set.add(`${y}-${pad2(m)}-${pad2(day)}`)
    } else {
      set.add(zonedDateKey(d, timeZone))
    }
  }
  return set
}

/** Store an occurrence local date as UTC midnight Date for exceptionDates. */
export function occurrenceDateToExceptionDate(occurrenceDate: string): Date {
  const { year, month, day } = parseDateKey(occurrenceDate)
  return new Date(Date.UTC(year, month - 1, day))
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function intervalsOverlapMs(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return intervalsOverlap(aStart, aEnd, bStart, bEnd)
}

function toOccurrence(
  series: CalendarBlockSeries,
  start: Date,
  end: Date,
  occurrenceDate: string
): CalendarBlockOccurrence {
  const freq = (series.recurrenceFrequency || 'none') as RecurrenceFrequency
  return {
    blockId: series.id,
    practiceId: series.practiceId,
    providerId: series.providerId,
    kind: series.kind === 'meeting' ? 'meeting' : 'block',
    title: series.title,
    notes: series.notes,
    startTime: start,
    endTime: end,
    timezone: series.timezone,
    isRecurring: freq !== 'none',
    occurrenceDate,
    series: {
      recurrenceFrequency: freq,
      recurrenceInterval: series.recurrenceInterval || 1,
      recurrenceByDay: series.recurrenceByDay || [],
      recurrenceUntil: series.recurrenceUntil?.toISOString() ?? null,
      recurrenceCount: series.recurrenceCount,
    },
  }
}

function isMatchingOccurrenceDay(
  series: CalendarBlockSeries,
  cursorKey: string,
  occStart: Date,
  timeZone: string
): boolean {
  const freq = (series.recurrenceFrequency || 'none') as RecurrenceFrequency
  const interval = Math.max(1, series.recurrenceInterval || 1)
  const anchorKey = zonedDateKey(series.startTime, timeZone)
  const daysFromAnchor = daysBetweenKeys(anchorKey, cursorKey)
  if (daysFromAnchor < 0) return false

  if (freq === 'daily') {
    return daysFromAnchor % interval === 0
  }

  if (freq === 'weekly') {
    const byDay = normalizeByDay(
      series.recurrenceByDay?.length
        ? series.recurrenceByDay
        : [WEEKDAY_CODES[zonedWeekdayIndex(series.startTime, timeZone)]]
    )
    if (!byDay.has(zonedWeekdayIndex(occStart, timeZone))) return false
    const weeksFromAnchor = Math.floor(daysFromAnchor / 7)
    return weeksFromAnchor % interval === 0
  }

  return false
}

/**
 * Expand calendar block series into concrete occurrences overlapping [rangeStart, rangeEnd).
 */
export function expandCalendarBlocks(
  seriesList: CalendarBlockSeries[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarBlockOccurrence[] {
  if (rangeEnd <= rangeStart) return []
  let effectiveEnd = rangeEnd
  if (effectiveEnd.getTime() - rangeStart.getTime() > MAX_RANGE_MS) {
    effectiveEnd = new Date(rangeStart.getTime() + MAX_RANGE_MS)
  }

  const out: CalendarBlockOccurrence[] = []

  for (const series of seriesList) {
    const durationMs = series.endTime.getTime() - series.startTime.getTime()
    if (durationMs <= 0) continue

    const timeZone = series.timezone || 'UTC'
    const freq = (series.recurrenceFrequency || 'none') as RecurrenceFrequency
    const exceptions = exceptionKeySet(series.exceptionDates || [], timeZone)
    const startParts = zonedTimeParts(series.startTime, timeZone)
    const anchorKey = zonedDateKey(series.startTime, timeZone)

    if (freq === 'none') {
      if (
        intervalsOverlap(series.startTime, series.endTime, rangeStart, effectiveEnd) &&
        !exceptions.has(anchorKey)
      ) {
        out.push(toOccurrence(series, series.startTime, series.endTime, anchorKey))
      }
      continue
    }

    const untilKey = series.recurrenceUntil
      ? zonedDateKey(series.recurrenceUntil, timeZone)
      : null

    // When count-limited, walk from series start so the count stays correct.
    // Otherwise jump near the query window for performance.
    const rangeStartKey = zonedDateKey(
      new Date(rangeStart.getTime() - durationMs),
      timeZone
    )
    let cursorKey =
      series.recurrenceCount != null
        ? anchorKey
        : compareDateKeys(anchorKey, rangeStartKey) > 0
          ? anchorKey
          : rangeStartKey

    let matchedCount = 0
    let steps = 0

    // If we jumped, estimate matchedCount only when needed (count path starts at anchor).
    while (steps < MAX_OCCURRENCES_PER_SERIES * 7 + 14) {
      steps++
      if (untilKey && compareDateKeys(cursorKey, untilKey) > 0) break

      const { year, month, day } = parseDateKey(cursorKey)
      const occStart = zonedLocalToUtc(
        year,
        month,
        day,
        startParts.hour,
        startParts.minute,
        startParts.second,
        timeZone
      )
      const occEnd = new Date(occStart.getTime() + durationMs)

      if (isMatchingOccurrenceDay(series, cursorKey, occStart, timeZone)) {
        if (series.recurrenceCount != null && matchedCount >= series.recurrenceCount) {
          break
        }
        matchedCount++
        if (!exceptions.has(cursorKey) && intervalsOverlap(occStart, occEnd, rangeStart, effectiveEnd)) {
          out.push(toOccurrence(series, occStart, occEnd, cursorKey))
        }
      }

      // Stop once we're past the query range
      if (compareDateKeys(cursorKey, zonedDateKey(effectiveEnd, timeZone)) > 0) {
        break
      }

      cursorKey = addDaysToDateKey(cursorKey, 1)
    }
  }

  out.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  return out
}
