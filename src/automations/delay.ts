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
