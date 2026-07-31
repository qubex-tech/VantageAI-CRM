/**
 * Helpers for patient birthday automation triggers.
 * DOB month/day is read from UTC calendar parts of the stored DateTime
 * to avoid off-by-one when DOBs are stored as midnight UTC date-only values.
 */

export const DEFAULT_PRACTICE_TIMEZONE = 'America/Chicago'
export const PATIENT_BIRTHDAY_EVENT = 'crm/patient.birthday'

export type ZonedDateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

export function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN)

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function getDobUtcMonthDay(dateOfBirth: Date): { month: number; day: number; year: number } {
  return {
    year: dateOfBirth.getUTCFullYear(),
    month: dateOfBirth.getUTCMonth() + 1,
    day: dateOfBirth.getUTCDate(),
  }
}

/**
 * Month/day pairs that should fire birthday events for a practice-local "today".
 * Feb 29 birthdays also match Feb 28 in non-leap years.
 */
export function getBirthdayMatchTargets(
  todayMonth: number,
  todayDay: number,
  todayYear: number
): Array<{ month: number; day: number }> {
  const targets = [{ month: todayMonth, day: todayDay }]

  if (todayMonth === 2 && todayDay === 28 && !isLeapYear(todayYear)) {
    targets.push({ month: 2, day: 29 })
  }

  return targets
}

export function dobMatchesToday(
  dateOfBirth: Date,
  todayMonth: number,
  todayDay: number,
  todayYear: number
): boolean {
  const dob = getDobUtcMonthDay(dateOfBirth)
  return getBirthdayMatchTargets(todayMonth, todayDay, todayYear).some(
    (target) => target.month === dob.month && target.day === dob.day
  )
}

export function computeAgeOnDate(
  dateOfBirth: Date,
  onYear: number,
  onMonth: number,
  onDay: number
): number {
  const dob = getDobUtcMonthDay(dateOfBirth)
  let age = onYear - dob.year
  if (onMonth < dob.month || (onMonth === dob.month && onDay < dob.day)) {
    age -= 1
  }
  return Math.max(0, age)
}

type AutomationActionLike = {
  type?: unknown
  args?: Record<string, unknown> | null
}

/**
 * Collect practice-local emit hours from birthday automation wait actions.
 * Prefer wait_until_send_window.startHour; also honor wait_until_local_time.hour.
 * Deduped and sorted ascending. Empty = no configured send time.
 */
export function extractBirthdayEmitHoursFromActions(actionsJson: unknown): number[] {
  if (!Array.isArray(actionsJson)) return []

  const hours = new Set<number>()
  for (const raw of actionsJson) {
    if (!raw || typeof raw !== 'object') continue
    const action = raw as AutomationActionLike
    const type = typeof action.type === 'string' ? action.type : ''
    const args = action.args && typeof action.args === 'object' ? action.args : {}

    let hour: number | null = null
    if (type === 'wait_until_send_window') {
      hour = Number(args.startHour)
    } else if (type === 'wait_until_local_time') {
      hour = Number(args.hour)
    }

    if (Number.isInteger(hour) && hour! >= 0 && hour! <= 23) {
      hours.add(hour!)
    }
  }

  return [...hours].sort((a, b) => a - b)
}

/** True when local hour matches a birthday automation send-window / local-time hour. */
export function shouldEmitBirthdaysAtLocalHour(
  localHour: number,
  emitHours: number[]
): boolean {
  if (!Array.isArray(emitHours) || emitHours.length === 0) return false
  return emitHours.includes(localHour)
}

export function formatBirthdayDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function buildPatientBirthdayPayload(patient: {
  id: string
  name: string
  firstName?: string | null
  lastName?: string | null
  preferredName?: string | null
  email?: string | null
  phone?: string | null
  primaryPhone?: string | null
  secondaryPhone?: string | null
  preferredContactMethod?: string | null
  dateOfBirth: Date
}, celebration: { year: number; month: number; day: number }) {
  return {
    patient: {
      id: patient.id,
      name: patient.name,
      firstName: patient.firstName,
      lastName: patient.lastName,
      preferredName: patient.preferredName,
      email: patient.email,
      phone: patient.phone,
      primaryPhone: patient.primaryPhone,
      secondaryPhone: patient.secondaryPhone,
      preferredContactMethod: patient.preferredContactMethod,
      dateOfBirth: patient.dateOfBirth.toISOString(),
    },
    birthday: {
      date: formatBirthdayDate(celebration.year, celebration.month, celebration.day),
      year: celebration.year,
      age: computeAgeOnDate(
        patient.dateOfBirth,
        celebration.year,
        celebration.month,
        celebration.day
      ),
    },
  }
}
