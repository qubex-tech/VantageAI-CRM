import { describe, it, expect } from 'vitest'
import {
  buildPatientBirthdayPayload,
  computeAgeOnDate,
  dobMatchesToday,
  getBirthdayMatchTargets,
  isBirthdayEmitHour,
  isLeapYear,
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

  describe('isBirthdayEmitHour', () => {
    it('only fires at 9am local', () => {
      expect(isBirthdayEmitHour(9)).toBe(true)
      expect(isBirthdayEmitHour(8)).toBe(false)
      expect(isBirthdayEmitHour(10)).toBe(false)
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
