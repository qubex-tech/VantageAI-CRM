import { describe, expect, it } from 'vitest'
import {
  cancellationDelayReadyAt,
  delayAmountToSeconds,
  delaySecondsFromArgs,
  inferDelayDisplay,
  secondsUntilInstant,
  splitDelayIntoSleepDurations,
  toInngestDuration,
  zonedYmd,
  MAX_DELAY_SECONDS,
} from '@/automations/delay'

describe('automation delay', () => {
  it('converts days and minutes to seconds', () => {
    expect(delayAmountToSeconds(14, 'days')).toBe(14 * 24 * 60 * 60)
    expect(delayAmountToSeconds(5, 'minutes')).toBe(300)
    expect(delayAmountToSeconds(60, 'seconds')).toBe(60)
  })

  it('prefers amount+unit over raw seconds', () => {
    expect(delaySecondsFromArgs({ seconds: 60, amount: 14, unit: 'days' })).toBe(1_209_600)
  })

  it('infers days from a stored seconds value', () => {
    expect(inferDelayDisplay({ seconds: 1_209_600 })).toEqual({ amount: 14, unit: 'days' })
    expect(inferDelayDisplay({ seconds: 60 })).toEqual({ amount: 1, unit: 'minutes' })
    expect(inferDelayDisplay({ amount: 14, unit: 'days' })).toEqual({ amount: 14, unit: 'days' })
  })

  it('splits a 14-day wait into 7-day Inngest sleeps', () => {
    expect(toInngestDuration(1_209_600)).toBe('14d')
    expect(splitDelayIntoSleepDurations(14 * 24 * 60 * 60)).toEqual(['7d', '7d'])
    expect(splitDelayIntoSleepDurations(60)).toEqual(['1m'])
  })

  it('allows a 14-day delay under the 30-day cap', () => {
    expect(delayAmountToSeconds(14, 'days')).toBeLessThanOrEqual(MAX_DELAY_SECONDS)
  })

  it('starts a cancellation delay on the visit day', () => {
    const appointmentStart = new Date('2026-11-03T23:30:00.000Z')
    const discoveredAt = new Date('2026-10-24T05:01:05.496Z')
    const readyAt = cancellationDelayReadyAt({
      appointmentStart,
      timeZone: 'America/Chicago',
      delaySeconds: 14 * 24 * 60 * 60,
      unit: 'days',
      amount: 14,
    })

    expect(zonedYmd(appointmentStart, 'America/Chicago')).toBe('2026-11-03')
    expect(readyAt.toISOString()).toBe('2026-11-17T06:00:00.000Z')
    const waitSeconds = secondsUntilInstant(discoveredAt, readyAt)
    expect(waitSeconds).toBeGreaterThan(14 * 24 * 60 * 60)
    expect(splitDelayIntoSleepDurations(waitSeconds).slice(0, 2)).toEqual(['7d', '7d'])
  })

  it('does not add another wait when the visit day plus the delay has passed', () => {
    const readyAt = cancellationDelayReadyAt({
      appointmentStart: new Date('2026-11-03T23:30:00.000Z'),
      timeZone: 'America/Chicago',
      delaySeconds: 14 * 24 * 60 * 60,
      unit: 'days',
      amount: 14,
    })
    expect(secondsUntilInstant(new Date('2026-11-20T15:00:00.000Z'), readyAt)).toBe(0)
  })

  it('keeps the local calendar day across the daylight-saving change', () => {
    const readyAt = cancellationDelayReadyAt({
      appointmentStart: new Date('2026-10-28T20:00:00.000Z'),
      timeZone: 'America/Chicago',
      delaySeconds: 14 * 24 * 60 * 60,
      unit: 'days',
      amount: 14,
    })
    expect(zonedYmd(readyAt, 'America/Chicago')).toBe('2026-11-11')
    expect(readyAt.toISOString()).toBe('2026-11-11T06:00:00.000Z')
  })
})
