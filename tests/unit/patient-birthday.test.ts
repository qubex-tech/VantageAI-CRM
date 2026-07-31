import { describe, it, expect } from 'vitest'
import {
  buildPatientBirthdayPayload,
  computeAgeOnDate,
  dobMatchesToday,
  extractBirthdayEmitHoursFromActions,
  getBirthdayMatchTargets,
  isLeapYear,
  shouldEmitBirthdaysAtLocalHour,
} from '@/automations/patient-birthday'

describe('patient birthday helpers', () => {
  describe('isLeapYear', () => {
    it('identifies leap years', () => {
      expect(isLeapYear(2024)).toBe(true)
      expect(isLeapYear(2000)).toBe(true)
      expect(isLeapYear(2025)).toBe(false)
      expect(isLeapYear(1900)).toBe(false)
    })
  })

  describe('getBirthdayMatchTargets', () => {
    it('returns only today for normal dates', () => {
      expect(getBirthdayMatchTargets(7, 22, 2026)).toEqual([{ month: 7, day: 22 }])
    })

    it('includes Feb 29 on Feb 28 in non-leap years', () => {
      expect(getBirthdayMatchTargets(2, 28, 2025)).toEqual([
        { month: 2, day: 28 },
        { month: 2, day: 29 },
      ])
    })

    it('does not include Feb 29 on Feb 28 in leap years', () => {
      expect(getBirthdayMatchTargets(2, 28, 2024)).toEqual([{ month: 2, day: 28 }])
    })

    it('matches Feb 29 exactly in leap years', () => {
      expect(getBirthdayMatchTargets(2, 29, 2024)).toEqual([{ month: 2, day: 29 }])
    })
  })

  describe('dobMatchesToday', () => {
    it('matches same month/day ignoring birth year', () => {
      const dob = new Date(Date.UTC(1990, 6, 22)) // July 22
      expect(dobMatchesToday(dob, 7, 22, 2026)).toBe(true)
      expect(dobMatchesToday(dob, 7, 21, 2026)).toBe(false)
    })

    it('matches Feb 29 DOB on Feb 28 in non-leap years', () => {
      const dob = new Date(Date.UTC(2000, 1, 29)) // Feb 29
      expect(dobMatchesToday(dob, 2, 28, 2025)).toBe(true)
      expect(dobMatchesToday(dob, 2, 28, 2024)).toBe(false)
      expect(dobMatchesToday(dob, 2, 29, 2024)).toBe(true)
    })
  })

  describe('computeAgeOnDate', () => {
    it('computes age on birthday', () => {
      const dob = new Date(Date.UTC(1990, 6, 22))
      expect(computeAgeOnDate(dob, 2026, 7, 22)).toBe(36)
    })

    it('computes age before birthday this year', () => {
      const dob = new Date(Date.UTC(1990, 6, 22))
      expect(computeAgeOnDate(dob, 2026, 7, 21)).toBe(35)
    })
  })

  describe('extractBirthdayEmitHoursFromActions', () => {
    it('reads startHour from wait_until_send_window', () => {
      expect(
        extractBirthdayEmitHoursFromActions([
          {
            type: 'wait_until_send_window',
            args: { startHour: 7, startMinute: 45, endHour: 20 },
          },
          { type: 'trigger_curogram_template', args: { actionId: 'x' } },
        ])
      ).toEqual([7])
    })

    it('reads hour from wait_until_local_time and dedupes', () => {
      expect(
        extractBirthdayEmitHoursFromActions([
          { type: 'wait_until_local_time', args: { hour: 8, minute: 0 } },
          { type: 'wait_until_send_window', args: { startHour: 8, endHour: 17 } },
          { type: 'wait_until_send_window', args: { startHour: 10, endHour: 17 } },
        ])
      ).toEqual([8, 10])
    })

    it('returns empty when no wait actions are configured', () => {
      expect(
        extractBirthdayEmitHoursFromActions([
          { type: 'trigger_curogram_template', args: { actionId: 'x' } },
        ])
      ).toEqual([])
    })
  })

  describe('shouldEmitBirthdaysAtLocalHour', () => {
    it('matches configured send hours only', () => {
      expect(shouldEmitBirthdaysAtLocalHour(7, [7])).toBe(true)
      expect(shouldEmitBirthdaysAtLocalHour(9, [7])).toBe(false)
      expect(shouldEmitBirthdaysAtLocalHour(7, [])).toBe(false)
    })
  })

  describe('buildPatientBirthdayPayload', () => {
    it('includes patient fields and birthday metadata', () => {
      const dob = new Date(Date.UTC(1990, 6, 22))
      const payload = buildPatientBirthdayPayload(
        {
          id: 'p1',
          name: 'Jane Doe',
          firstName: 'Jane',
          lastName: 'Doe',
          preferredName: 'Janie',
          email: 'jane@example.com',
          phone: '+15551234567',
          primaryPhone: '+15551234567',
          secondaryPhone: null,
          preferredContactMethod: 'sms',
          dateOfBirth: dob,
        },
        { year: 2026, month: 7, day: 22 }
      )

      expect(payload.patient.id).toBe('p1')
      expect(payload.patient.firstName).toBe('Jane')
      expect(payload.birthday).toEqual({
        date: '2026-07-22',
        year: 2026,
        age: 36,
      })
    })
  })
})
