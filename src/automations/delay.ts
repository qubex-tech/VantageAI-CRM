export type DelayUnit = 'seconds' | 'minutes' | 'days'

export const DELAY_UNITS: { value: DelayUnit; label: string }[] = [
  { value: 'seconds', label: 'Seconds' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'days', label: 'Days' },
]

export const MAX_DELAY_DAYS = 30
export const SECONDS_PER_MINUTE = 60
export const SECONDS_PER_DAY = 24 * 60 * 60
export const MAX_DELAY_SECONDS = MAX_DELAY_DAYS * SECONDS_PER_DAY
/** Inngest free plans cap a single sleep at 7 days; chunk longer waits. */
export const MAX_INNGEST_SLEEP_CHUNK_SECONDS = 7 * SECONDS_PER_DAY

export function isDelayUnit(value: unknown): value is DelayUnit {
  return value === 'seconds' || value === 'minutes' || value === 'days'
}

export function delayAmountToSeconds(amount: number, unit: DelayUnit): number {
  if (!Number.isFinite(amount) || amount < 0) return 0
  const whole = Math.floor(amount)
  if (unit === 'days') return whole * SECONDS_PER_DAY
  if (unit === 'minutes') return whole * SECONDS_PER_MINUTE
  return whole
}

export function delaySecondsFromArgs(args: {
  seconds?: unknown
  amount?: unknown
  unit?: unknown
}): number {
  if (isDelayUnit(args.unit) && args.amount != null && args.amount !== '') {
    const amount = Number(args.amount)
    if (Number.isFinite(amount) && amount > 0) {
      return delayAmountToSeconds(amount, args.unit)
    }
  }
  const seconds = Number(args.seconds)
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.floor(seconds)
}

export function inferDelayDisplay(args: {
  seconds?: unknown
  amount?: unknown
  unit?: unknown
}): { amount: number; unit: DelayUnit } {
  if (isDelayUnit(args.unit)) {
    const amount = Number(args.amount)
    if (Number.isFinite(amount) && amount > 0) {
      return { amount: Math.floor(amount), unit: args.unit }
    }
    const seconds = Number(args.seconds)
    if (Number.isFinite(seconds) && seconds > 0) {
      return {
        amount: Math.max(1, Math.round(seconds / delayAmountToSeconds(1, args.unit))),
        unit: args.unit,
      }
    }
  }

  const seconds = Math.max(0, Math.floor(Number(args.seconds) || 0))
  if (seconds > 0 && seconds % SECONDS_PER_DAY === 0) {
    return { amount: seconds / SECONDS_PER_DAY, unit: 'days' }
  }
  if (seconds > 0 && seconds % SECONDS_PER_MINUTE === 0) {
    return { amount: seconds / SECONDS_PER_MINUTE, unit: 'minutes' }
  }
  return { amount: seconds, unit: 'seconds' }
}

export function maxAmountForUnit(unit: DelayUnit): number {
  if (unit === 'days') return MAX_DELAY_DAYS
  if (unit === 'minutes') return MAX_DELAY_SECONDS / SECONDS_PER_MINUTE
  return MAX_DELAY_SECONDS
}

/** Inngest `ms` duration strings, preferring days/hours/minutes. */
export function toInngestDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  if (whole % SECONDS_PER_DAY === 0) return `${whole / SECONDS_PER_DAY}d`
  if (whole % 3600 === 0) return `${whole / 3600}h`
  if (whole % SECONDS_PER_MINUTE === 0) return `${whole / SECONDS_PER_MINUTE}m`
  return `${whole}s`
}

export function splitDelayIntoSleepDurations(totalSeconds: number): string[] {
  const whole = Math.max(0, Math.floor(totalSeconds))
  if (whole <= 0) return []
  const chunks: string[] = []
  let remaining = whole
  while (remaining > 0) {
    const chunk = Math.min(remaining, MAX_INNGEST_SLEEP_CHUNK_SECONDS)
    chunks.push(toInngestDuration(chunk))
    remaining -= chunk
  }
  return chunks
}

/** Offset (ms) such that `utcInstant + offset` equals the wall clock in `timeZone`. */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(instant)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - instant.getTime()
}

/** UTC instant for `YYYY-MM-DD` at 00:00 in `timeZone`. */
export function zonedMidnight(ymd: string, timeZone: string): Date {
  const [year, month, day] = ymd.split('-').map(Number)
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0)
  const offset1 = timeZoneOffsetMs(new Date(utcGuess), timeZone)
  let ts = utcGuess - offset1
  const offset2 = timeZoneOffsetMs(new Date(ts), timeZone)
  if (offset2 !== offset1) ts = utcGuess - offset2
  return new Date(ts)
}

export function zonedYmd(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/**
 * When a cancellation delay should finish.
 * The clock starts at local midnight on the day the visit was scheduled, then
 * the configured delay runs from that morning. A 14-day delay on a November 3
 * visit is ready at local midnight on November 17.
 */
export function cancellationDelayReadyAt(params: {
  appointmentStart: Date
  timeZone: string
  delaySeconds: number
  unit?: unknown
  amount?: unknown
}): Date {
  const appointmentDay = zonedYmd(params.appointmentStart, params.timeZone)
  const amount = Number(params.amount)
  if (params.unit === 'days' && Number.isFinite(amount) && amount > 0) {
    return zonedMidnight(addCalendarDays(appointmentDay, Math.floor(amount)), params.timeZone)
  }
  const dayStart = zonedMidnight(appointmentDay, params.timeZone)
  return new Date(dayStart.getTime() + Math.max(0, Math.floor(params.delaySeconds)) * 1000)
}

/** Whole seconds from `from` until `until`. Zero when the ready time has passed. */
export function secondsUntilInstant(from: Date, until: Date): number {
  return Math.max(0, Math.floor((until.getTime() - from.getTime()) / 1000))
}
