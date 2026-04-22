/**
 * Call analytics date ranges: interpret YYYY-MM-DD as UTC calendar days so
 * Prisma windows align with Retell's Unix ms timestamps (UTC).
 */

const MS_PER_DAY = 86400000
export const MAX_CALL_RANGE_DAYS = 366

function parseCalendarDateUtc(value: string): { y: number; m: number; d: number } | null {
  const parts = value.split('-').map(Number)
  if (parts.length !== 3) return null
  const [y, m, d] = parts
  if (!y || !m || !d) return null
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return { y, m, d }
}

export function utcBoundsForCalendarDate(y: number, month: number, day: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(y, month - 1, day, 0, 0, 0, 0))
  const end = new Date(Date.UTC(y, month - 1, day, 23, 59, 59, 999))
  return { start, end }
}

function utcStartOfInstant(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0))
}

/**
 * Resolve inclusive UTC range for voice analytics + Retell list-calls filters.
 */
export function resolveCallDateRangeUtc(
  params: { callFrom?: string; callTo?: string },
  now: Date = new Date()
): { from: Date; to: Date } {
  const uy = now.getUTCFullYear()
  const um = now.getUTCMonth()
  const ud = now.getUTCDate()

  const defaultFrom = new Date(Date.UTC(uy, um, ud - 30, 0, 0, 0, 0))
  const defaultTo = new Date(Date.UTC(uy, um, ud, 23, 59, 59, 999))

  const fromParsed = params.callFrom ? parseCalendarDateUtc(params.callFrom) : null
  const toParsed = params.callTo ? parseCalendarDateUtc(params.callTo) : null

  let from = fromParsed ? utcBoundsForCalendarDate(fromParsed.y, fromParsed.m, fromParsed.d).start : defaultFrom
  let to = toParsed ? utcBoundsForCalendarDate(toParsed.y, toParsed.m, toParsed.d).end : defaultTo

  if (from.getTime() > to.getTime()) {
    from = defaultFrom
    to = defaultTo
  }

  const spanDays = (to.getTime() - from.getTime()) / MS_PER_DAY
  if (spanDays > MAX_CALL_RANGE_DAYS) {
    const clampedFromMs = to.getTime() - MAX_CALL_RANGE_DAYS * MS_PER_DAY
    from = utcStartOfInstant(new Date(clampedFromMs))
  }

  return { from, to }
}

/** Rolling "last 7 days" boundary in UTC (matches call window semantics). */
export function last7DaysStartUtc(now: Date = new Date()): Date {
  const uy = now.getUTCFullYear()
  const um = now.getUTCMonth()
  const ud = now.getUTCDate()
  return new Date(Date.UTC(uy, um, ud - 7, 0, 0, 0, 0))
}
