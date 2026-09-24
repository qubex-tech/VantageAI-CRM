import { describe, expect, it } from 'vitest'
import {
  calendarDaysUntil,
  clampUpcomingDays,
  extractUpcomingDaysBeforeFromActions,
  extractUpcomingDaysBeforeFromConditions,
  extractUpcomingEmitConfig,
  ruleMatchesUpcomingWindow,
  shouldEmitUpcomingForDaysUntil,
  upcomingEmitKey,
} from '@/automations/appointment-upcoming'

describe('appointment upcoming helpers', () => {
  describe('clampUpcomingDays', () => {
    it('accepts whole numbers from 0 to 30', () => {
      expect(clampUpcomingDays(0)).toBe(0)
      expect(clampUpcomingDays(7)).toBe(7)
      expect(clampUpcomingDays('3')).toBe(3)
      expect(clampUpcomingDays(30)).toBe(30)
    })

    it('rejects out of range and non-numeric values', () => {
      expect(clampUpcomingDays(-1)).toBeNull()
      expect(clampUpcomingDays(31)).toBeNull()
      expect(clampUpcomingDays('abc')).toBeNull()
      expect(clampUpcomingDays(undefined)).toBeNull()
    })
  })

  describe('extractUpcomingDaysBefore', () => {
    it('reads upcomingDaysBefore from conditions', () => {
      expect(
        extractUpcomingDaysBeforeFromConditions({
          operator: 'and',
          conditions: [],
          upcomingDaysBefore: 5,
        })
      ).toBe(5)
    })

    it('reads daysBefore from run_eligibility actions', () => {
      expect(
        extractUpcomingDaysBeforeFromActions([
          { type: 'send_sms', args: { message: 'hi' } },
          { type: 'run_eligibility', args: { daysBefore: 7 } },
        ])
      ).toEqual([7])
    })
  })

  describe('extractUpcomingEmitConfig', () => {
    it('defaults legacy rules to a 2-day daily window', () => {
      expect(
        extractUpcomingEmitConfig([
          { conditionsJson: { operator: 'and', conditions: [] }, actionsJson: [] },
        ])
      ).toEqual({
        targetDays: [],
        windowDays: 2,
        emitDailyInWindow: true,
      })
    })

    it('uses explicit days-before from the trigger and eligibility action', () => {
      expect(
        extractUpcomingEmitConfig([
          {
            conditionsJson: { upcomingDaysBefore: 7 },
            actionsJson: [{ type: 'run_eligibility', args: { daysBefore: 7 } }],
          },
          {
            conditionsJson: { upcomingDaysBefore: 2 },
            actionsJson: [{ type: 'send_sms', args: {} }],
          },
        ])
      ).toEqual({
        targetDays: [2, 7],
        windowDays: 7,
        emitDailyInWindow: false,
      })
    })

    it('expands the window from daysUntilStart conditions', () => {
      expect(
        extractUpcomingEmitConfig([
          {
            conditionsJson: {
              operator: 'and',
              conditions: [{ field: 'appointment.daysUntilStart', operator: 'equals', value: 10 }],
              upcomingDaysBefore: 3,
            },
            actionsJson: [],
          },
        ])
      ).toEqual({
        targetDays: [3],
        windowDays: 10,
        emitDailyInWindow: false,
      })
    })
  })

  describe('calendarDaysUntil', () => {
    it('counts whole local calendar days, not raw hours', () => {
      const now = new Date('2026-09-20T22:00:00.000Z') // Sep 20 evening Chicago
      const start = new Date('2026-09-23T15:00:00.000Z') // Sep 23 morning Chicago
      expect(calendarDaysUntil(start, now, 'America/Chicago')).toBe(3)
    })

    it('returns 0 on the appointment day', () => {
      const now = new Date('2026-09-23T13:00:00.000Z')
      const start = new Date('2026-09-23T20:00:00.000Z')
      expect(calendarDaysUntil(start, now, 'America/Chicago')).toBe(0)
    })
  })

  describe('shouldEmitUpcomingForDaysUntil', () => {
    it('emits on the configured day and when booked inside the window', () => {
      const config = { targetDays: [7], windowDays: 7, emitDailyInWindow: false }
      expect(shouldEmitUpcomingForDaysUntil(7, config)).toBe(true)
      expect(shouldEmitUpcomingForDaysUntil(3, config)).toBe(true)
      expect(shouldEmitUpcomingForDaysUntil(8, config)).toBe(false)
      expect(shouldEmitUpcomingForDaysUntil(-1, config)).toBe(false)
    })

    it('emits daily in the window for legacy rules', () => {
      const config = { targetDays: [], windowDays: 2, emitDailyInWindow: true }
      expect(shouldEmitUpcomingForDaysUntil(2, config)).toBe(true)
      expect(shouldEmitUpcomingForDaysUntil(1, config)).toBe(true)
      expect(shouldEmitUpcomingForDaysUntil(0, config)).toBe(true)
      expect(shouldEmitUpcomingForDaysUntil(3, config)).toBe(false)
    })
  })

  describe('ruleMatchesUpcomingWindow', () => {
    it('matches when the visit is on or inside the days-before window', () => {
      expect(
        ruleMatchesUpcomingWindow({
          triggerEvent: 'crm/appointment.upcoming',
          conditionsJson: { upcomingDaysBefore: 7 },
          daysUntilStart: 7,
        })
      ).toBe(true)
      expect(
        ruleMatchesUpcomingWindow({
          triggerEvent: 'crm/appointment.upcoming',
          conditionsJson: { upcomingDaysBefore: 7 },
          daysUntilStart: 3,
        })
      ).toBe(true)
      expect(
        ruleMatchesUpcomingWindow({
          triggerEvent: 'crm/appointment.upcoming',
          conditionsJson: { upcomingDaysBefore: 7 },
          daysUntilStart: 8,
        })
      ).toBe(false)
    })

    it('does not apply the window to other trigger events', () => {
      expect(
        ruleMatchesUpcomingWindow({
          triggerEvent: 'crm/appointment.created',
          conditionsJson: { upcomingDaysBefore: 7 },
          daysUntilStart: 20,
        })
      ).toBe(true)
    })
  })

  describe('upcomingEmitKey', () => {
    it('is unique per appointment and days-until', () => {
      expect(upcomingEmitKey('appt-1', 7)).toBe('appt-1:7')
    })
  })
})
