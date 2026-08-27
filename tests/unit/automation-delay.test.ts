import { describe, expect, it } from 'vitest'
import {
  delayAmountToSeconds,
  delaySecondsFromArgs,
  inferDelayDisplay,
  splitDelayIntoSleepDurations,
  toInngestDuration,
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
})
