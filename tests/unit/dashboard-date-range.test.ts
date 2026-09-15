import { describe, expect, it } from 'vitest'
import {
  dashboardPeriodHealixLabel,
  dashboardPeriodShortLabel,
  dashboardRangeDayCount,
  dashboardRangePath,
  formatDashboardPeriodLabel,
  parseDashboardRangeParam,
  resolveDashboardPeriodRange,
} from '@/lib/analytics/dashboardDateRange'

describe('parseDashboardRangeParam', () => {
  it('reads today, yesterday, 7, and 30', () => {
    expect(parseDashboardRangeParam({ range: 'today' })).toBe('today')
    expect(parseDashboardRangeParam({ range: 'yesterday' })).toBe('yesterday')
    expect(parseDashboardRangeParam({ range: '7' })).toBe('7')
    expect(parseDashboardRangeParam({ range: '30' })).toBe('30')
  })

  it('keeps the legacy days query and defaults to today', () => {
    expect(parseDashboardRangeParam({ days: '30' })).toBe('30')
    expect(parseDashboardRangeParam({ days: '7' })).toBe('7')
    expect(parseDashboardRangeParam({})).toBe('today')
    expect(parseDashboardRangeParam({ range: 'nope' })).toBe('today')
  })
})

describe('dashboard range helpers', () => {
  it('builds dashboard URLs', () => {
    expect(dashboardRangePath('today')).toBe('/dashboard')
    expect(dashboardRangePath('yesterday')).toBe('/dashboard?range=yesterday')
    expect(dashboardRangePath('7')).toBe('/dashboard?range=7')
    expect(dashboardRangePath('30')).toBe('/dashboard?range=30')
  })

  it('returns day counts and labels', () => {
    expect(dashboardRangeDayCount('today')).toBe(1)
    expect(dashboardRangeDayCount('yesterday')).toBe(1)
    expect(dashboardRangeDayCount('7')).toBe(7)
    expect(dashboardRangeDayCount('30')).toBe(30)
    expect(dashboardPeriodShortLabel('today')).toBe('Today')
    expect(dashboardPeriodHealixLabel('yesterday')).toBe('Yesterday')
  })
})

describe('resolveDashboardPeriodRange', () => {
  const timeZone = 'America/Chicago'
  const now = new Date('2026-09-12T02:00:00.000Z')

  it('resolves today and yesterday as single calendar days', () => {
    const today = resolveDashboardPeriodRange('today', timeZone, now)
    const yesterday = resolveDashboardPeriodRange('yesterday', timeZone, now)

    expect(formatDashboardPeriodLabel('today', today.from, today.to, timeZone)).toBe(
      'Today · Sep 11, 2026'
    )
    expect(formatDashboardPeriodLabel('yesterday', yesterday.from, yesterday.to, timeZone)).toBe(
      'Yesterday · Sep 10, 2026'
    )
    expect(yesterday.to.getTime()).toBeLessThan(today.from.getTime())
  })
})
