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

/**
 * True when local wall time is inside [start, end).
 * Supports overnight windows (e.g. 22:00–06:00).
 * A zero-width window (start === end) is treated as never open.
 */
export function isWithinSendWindow(params: {
  startHour: number
  startMinute?: number
  endHour: number
  endMinute?: number
  timeZone: string
  now?: Date
}): boolean {
  const start = toMinutes(params.startHour, params.startMinute ?? 0)
  const end = toMinutes(params.endHour, params.endMinute ?? 0)
  if (start === end) return false

  const current = zonedParts(params.now ?? new Date(), params.timeZone)
  const nowMinutes = current.hour * 60 + current.minute

  if (start < end) {
    return nowMinutes >= start && nowMinutes < end
  }
  // Overnight: open from start through midnight, then midnight until end
  return nowMinutes >= start || nowMinutes < end
}

/**
 * Milliseconds to wait until the next send-window open time.
 * Returns 0 when already inside the window.
 * Caps at 24h for Inngest sleep bounds.
 */
export function msUntilSendWindow(params: {
  startHour: number
  startMinute?: number
  endHour: number
  endMinute?: number
  timeZone: string
  now?: Date
  graceMs?: number
}): number {
  if (
    isWithinSendWindow({
      startHour: params.startHour,
      startMinute: params.startMinute,
      endHour: params.endHour,
      endMinute: params.endMinute,
      timeZone: params.timeZone,
      now: params.now,
    })
  ) {
    return 0
  }

  return msUntilLocalTime({
    hour: params.startHour,
    minute: params.startMinute ?? 0,
    timeZone: params.timeZone,
    now: params.now,
    graceMs: params.graceMs,
  })
}
