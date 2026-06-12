/**
 * Rolling calendar-day windows in an IANA timezone (for dashboard / staff analytics).
 */

const MS_PER_DAY = 86400000

export function getZonedCalendarParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  return { year, month, day }
}

/** UTC instant for local wall-clock time in `timeZone`. */
export function zonedLocalTimeToUtc(
  parts: {
    year: number
    month: number
    day: number
    hour?: number
    minute?: number
    second?: number
    millisecond?: number
  },
  timeZone: string
): Date {
  const {
    year,
    month,
    day,
    hour = 0,
    minute = 0,
    second = 0,
    millisecond = 0,
  } = parts

  let utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)

  for (let i = 0; i < 4; i++) {
    const offsetMs = getTimeZoneOffsetMs(new Date(utcGuess), timeZone)
    utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - offsetMs
  }

  return new Date(utcGuess)
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
  const zoned = new Date(date.toLocaleString('en-US', { timeZone }))
  return zoned.getTime() - utc.getTime()
}

function addCalendarDays(parts: { year: number; month: number; day: number }, deltaDays: number) {
  const anchor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + deltaDays))
  return {
    year: anchor.getUTCFullYear(),
    month: anchor.getUTCMonth() + 1,
    day: anchor.getUTCDate(),
  }
}

/**
 * Inclusive rolling window: today plus the previous (days - 1) calendar days in `timeZone`.
 */
export function resolveRollingDayRangeInTimeZone(
  days: number,
  timeZone: string,
  now: Date = new Date()
): { from: Date; to: Date; timeZone: string } {
  const today = getZonedCalendarParts(now, timeZone)
  const startDay = addCalendarDays(today, -(days - 1))

  const from = zonedLocalTimeToUtc(
    { ...startDay, hour: 0, minute: 0, second: 0, millisecond: 0 },
    timeZone
  )
  const to = zonedLocalTimeToUtc(
    { ...today, hour: 23, minute: 59, second: 59, millisecond: 999 },
    timeZone
  )

  return { from, to, timeZone }
}

export function formatRollingRangeLabel(
  from: Date,
  to: Date,
  timeZone: string,
  locale = 'en-US'
): string {
  const fmt: Intl.DateTimeFormatOptions = {
    timeZone,
    month: 'short',
    day: 'numeric',
  }
  const startLabel = from.toLocaleDateString(locale, fmt)
  const endLabel = to.toLocaleDateString(locale, { ...fmt, year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

export function rollingRangeSpanDays(from: Date, to: Date): number {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / MS_PER_DAY) + 1)
}

/**
 * Dashboard / Retell window: today plus the previous (days - 1) calendar days in `timeZone`.
 * Matches Retell dashboard "past N days" and the prior 178-call alignment.
 */
export function resolveDashboardRangeInTimeZone(
  days: number,
  timeZone: string,
  now: Date = new Date()
): { from: Date; to: Date; startMs: number; endMs: number; timeZone: string } {
  const { from, to, timeZone: tz } = resolveRollingDayRangeInTimeZone(days, timeZone, now)
  return {
    from,
    to,
    startMs: from.getTime(),
    endMs: to.getTime(),
    timeZone: tz,
  }
}

export function formatDashboardRangeLabel(
  days: number,
  from: Date,
  to: Date,
  timeZone: string
): string {
  return `Last ${days} days · ${formatRollingRangeLabel(from, to, timeZone)}`
}
