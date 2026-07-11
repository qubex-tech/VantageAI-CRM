/**
 * Compute how long to sleep until the next occurrence of hour:minute
 * in the given IANA timezone (e.g. America/Chicago).
 */

function zonedParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** Approximate UTC instant for a wall-clock time in `timeZone`. */
function wallTimeToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute: number; second?: number },
  timeZone: string
): Date {
  let guess = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second ?? 0
    )
  )

  for (let i = 0; i < 3; i++) {
    const asZoned = zonedParts(guess, timeZone)
    const desiredAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second ?? 0
    )
    const actualAsUtc = Date.UTC(
      asZoned.year,
      asZoned.month - 1,
      asZoned.day,
      asZoned.hour,
      asZoned.minute,
      asZoned.second
    )
    guess = new Date(guess.getTime() + (desiredAsUtc - actualAsUtc))
  }

  return guess
}

function addCalendarDays(
  parts: { year: number; month: number; day: number },
  days: number
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  }
}

/** 0 = Sunday … 6 = Saturday (JS Date.getDay convention). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const WEEKDAY_OPTIONS: Array<{ value: Weekday; label: string; short: string }> = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
]

const WEEKDAY_SHORT_TO_NUM: Record<string, Weekday> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function zonedWeekday(date: Date, timeZone: string): Weekday {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(date)
  return WEEKDAY_SHORT_TO_NUM[short] ?? 0
}

function weekdayForLocalYmd(
  ymd: { year: number; month: number; day: number },
  timeZone: string
): Weekday {
  // Noon avoids DST edge ambiguity when mapping calendar day → weekday
  const noon = wallTimeToUtc({ ...ymd, hour: 12, minute: 0, second: 0 }, timeZone)
  return zonedWeekday(noon, timeZone)
}

/**
 * Milliseconds until the next local `hour:minute` in `timeZone`.
 * If that time is already in the past today (or within `graceMs`), targets tomorrow.
 * Caps at 24h so it stays within Inngest sleep-friendly bounds.
 */
export function msUntilLocalTime(params: {
  hour: number
  minute: number
  timeZone: string
  now?: Date
  /** If we're within this many ms of the target, treat as already reached (default 30s). */
  graceMs?: number
}): number {
  const hour = Math.min(23, Math.max(0, Math.round(params.hour)))
  const minute = Math.min(59, Math.max(0, Math.round(params.minute)))
  const now = params.now ?? new Date()
  const graceMs = params.graceMs ?? 30_000
  const timeZone = params.timeZone

  const current = zonedParts(now, timeZone)
  let targetDay = { year: current.year, month: current.month, day: current.day }
  let target = wallTimeToUtc(
    { ...targetDay, hour, minute, second: 0 },
    timeZone
  )

  if (target.getTime() <= now.getTime() + graceMs) {
    targetDay = addCalendarDays(targetDay, 1)
    target = wallTimeToUtc({ ...targetDay, hour, minute, second: 0 }, timeZone)
  }

  const ms = Math.max(0, target.getTime() - now.getTime())
  return Math.min(ms, 24 * 60 * 60 * 1000)
}

function clampHour(value: number) {
  return Math.min(23, Math.max(0, Math.round(value)))
}

function clampMinute(value: number) {
  return Math.min(59, Math.max(0, Math.round(value)))
}

function toMinutes(hour: number, minute: number) {
  return clampHour(hour) * 60 + clampMinute(minute)
}

/** Empty / missing → all days allowed. */
export function normalizeAllowedWeekdays(daysOfWeek?: number[] | null): Weekday[] | null {
  if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) return null
  const allowed = Array.from(
    new Set(
      daysOfWeek
        .map((d) => Math.round(Number(d)))
        .filter((d) => Number.isFinite(d) && d >= 0 && d <= 6)
    )
  ) as Weekday[]
  return allowed.length > 0 ? allowed : null
}

function isWithinHoursOnly(params: {
  startHour: number
  startMinute?: number
  endHour: number
  endMinute?: number
  hour: number
  minute: number
}): boolean {
  const start = toMinutes(params.startHour, params.startMinute ?? 0)
  const end = toMinutes(params.endHour, params.endMinute ?? 0)
  if (start === end) return false
  const nowMinutes = params.hour * 60 + params.minute
  if (start < end) {
    return nowMinutes >= start && nowMinutes < end
  }
  return nowMinutes >= start || nowMinutes < end
}

/**
 * True when local wall time is inside [start, end) and on an allowed weekday.
 * Supports overnight windows (e.g. 22:00–06:00).
 * A zero-width window (start === end) is treated as never open.
 * Missing/empty daysOfWeek = every day.
 */
export function isWithinSendWindow(params: {
  startHour: number
  startMinute?: number
  endHour: number
  endMinute?: number
  /** 0=Sun … 6=Sat. Empty/omitted = all days. */
  daysOfWeek?: number[] | null
  timeZone: string
  now?: Date
}): boolean {
  const now = params.now ?? new Date()
  const allowed = normalizeAllowedWeekdays(params.daysOfWeek)
  if (allowed && !allowed.includes(zonedWeekday(now, params.timeZone))) {
    return false
  }

  const current = zonedParts(now, params.timeZone)
  return isWithinHoursOnly({
    startHour: params.startHour,
    startMinute: params.startMinute,
    endHour: params.endHour,
    endMinute: params.endMinute,
    hour: current.hour,
    minute: current.minute,
  })
}

const MAX_SEND_WINDOW_WAIT_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Milliseconds to wait until the next send-window open time
 * (allowed weekday + start hour).
 * Returns 0 when already inside the window.
 * Caps at 7 days (weekend → Monday).
 */
export function msUntilSendWindow(params: {
  startHour: number
  startMinute?: number
  endHour: number
  endMinute?: number
  daysOfWeek?: number[] | null
  timeZone: string
  now?: Date
  graceMs?: number
}): number {
  const now = params.now ?? new Date()
  const graceMs = params.graceMs ?? 30_000
  const timeZone = params.timeZone
  const allowed = normalizeAllowedWeekdays(params.daysOfWeek)

  if (
    isWithinSendWindow({
      startHour: params.startHour,
      startMinute: params.startMinute,
      endHour: params.endHour,
      endMinute: params.endMinute,
      daysOfWeek: allowed,
      timeZone,
      now,
    })
  ) {
    return 0
  }

  const startHour = clampHour(params.startHour)
  const startMinute = clampMinute(params.startMinute ?? 0)
  const current = zonedParts(now, timeZone)

  for (let offset = 0; offset <= 7; offset++) {
    const day = addCalendarDays(
      { year: current.year, month: current.month, day: current.day },
      offset
    )
    if (allowed && !allowed.includes(weekdayForLocalYmd(day, timeZone))) {
      continue
    }
    const candidate = wallTimeToUtc(
      { ...day, hour: startHour, minute: startMinute, second: 0 },
      timeZone
    )
    if (candidate.getTime() <= now.getTime() + graceMs) {
      continue
    }
    return Math.min(candidate.getTime() - now.getTime(), MAX_SEND_WINDOW_WAIT_MS)
  }

  return MAX_SEND_WINDOW_WAIT_MS
}
