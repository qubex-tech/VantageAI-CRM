const BUSINESS_WEEKDAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])

function weekdayShort(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date)
}

function isBusinessDay(date: Date, timeZone: string) {
  return BUSINESS_WEEKDAYS.has(weekdayShort(date, timeZone))
}

function calendarDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00'
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
  }
}

/** Local calendar date at noon UTC anchor (stable for TZ day boundaries). */
function dateAtNoonUtc(dateStr: string) {
  return new Date(`${dateStr}T12:00:00.000Z`)
}

function addCalendarDays(dateStr: string, days: number, timeZone: string) {
  const cursor = dateAtNoonUtc(dateStr)
  cursor.setUTCDate(cursor.getUTCDate() + days)
  return calendarDateParts(cursor, timeZone).dateStr
}

/** End of calendar day in practice TZ (last ms before next local day). */
export function endOfCalendarDay(date: Date, timeZone: string): Date {
  const { dateStr } = calendarDateParts(date, timeZone)
  const nextDay = addCalendarDays(dateStr, 1, timeZone)
  return new Date(dateAtNoonUtc(nextDay).getTime() - 1)
}

/** Advance by N business days (Mon–Fri) from a calendar anchor date. */
export function addBusinessDays(date: Date, businessDays: number, timeZone: string): Date {
  if (businessDays <= 0) return new Date(date)
  let { dateStr } = calendarDateParts(date, timeZone)
  let remaining = businessDays
  while (remaining > 0) {
    dateStr = addCalendarDays(dateStr, 1, timeZone)
    if (isBusinessDay(dateAtNoonUtc(dateStr), timeZone)) {
      remaining -= 1
    }
  }
  return endOfCalendarDay(dateAtNoonUtc(dateStr), timeZone)
}

/** Last instant of the Nth business day counting from today (inclusive). */
export function getBufferWindowEnd(from: Date, bufferBusinessDays: number, timeZone: string): Date {
  if (bufferBusinessDays < 1) {
    return endOfCalendarDay(from, timeZone)
  }
  let { dateStr } = calendarDateParts(from, timeZone)
  let counted = 0
  while (counted < bufferBusinessDays) {
    if (isBusinessDay(dateAtNoonUtc(dateStr), timeZone)) {
      counted += 1
    }
    if (counted < bufferBusinessDays) {
      dateStr = addCalendarDays(dateStr, 1, timeZone)
    }
  }
  return endOfCalendarDay(dateAtNoonUtc(dateStr), timeZone)
}

export function isWithinBufferWindow(
  slotStart: Date,
  bufferBusinessDays: number,
  timeZone: string,
  now = new Date()
): boolean {
  if (slotStart <= now) return false
  const windowEnd = getBufferWindowEnd(now, bufferBusinessDays, timeZone)
  return slotStart.getTime() <= windowEnd.getTime()
}

/** End of the Nth business day after slotStart (look-ahead horizon for candidates). */
export function getLookAheadEnd(
  slotStart: Date,
  lookAheadBusinessDays: number,
  timeZone: string
): Date {
  return addBusinessDays(slotStart, lookAheadBusinessDays, timeZone)
}
