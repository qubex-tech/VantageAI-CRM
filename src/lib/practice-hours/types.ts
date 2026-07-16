export const WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number]

export type DayHours = {
  enabled: boolean
  /** Local time HH:mm */
  open: string
  /** Local time HH:mm */
  close: string
}

export type LunchHours = {
  enabled: boolean
  /** Local time HH:mm */
  start: string
  /** Local time HH:mm */
  end: string
}

export type HoursOfOperationSettings = {
  /** IANA timezone for open/close/lunch wall-clock times (e.g. America/Chicago). */
  timezone: string
  days: Record<WeekdayKey, DayHours>
  lunch: LunchHours
}

export const DEFAULT_DAY_CLOSED: DayHours = {
  enabled: false,
  open: '09:00',
  close: '17:00',
}

export const DEFAULT_DAY_OPEN: DayHours = {
  enabled: true,
  open: '08:00',
  close: '17:00',
}

export const DEFAULT_LUNCH: LunchHours = {
  enabled: true,
  start: '12:00',
  end: '13:00',
}

export const DEFAULT_HOURS_OF_OPERATION: HoursOfOperationSettings = {
  timezone: 'America/Chicago',
  days: {
    monday: { ...DEFAULT_DAY_OPEN },
    tuesday: { ...DEFAULT_DAY_OPEN },
    wednesday: { ...DEFAULT_DAY_OPEN },
    thursday: { ...DEFAULT_DAY_OPEN },
    friday: { ...DEFAULT_DAY_OPEN },
    saturday: { ...DEFAULT_DAY_CLOSED },
    sunday: { ...DEFAULT_DAY_CLOSED },
  },
  lunch: { ...DEFAULT_LUNCH },
}

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}
