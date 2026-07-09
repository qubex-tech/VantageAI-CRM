export const CALENDAR_BLOCK_KINDS = ['block', 'meeting'] as const
export type CalendarBlockKind = (typeof CALENDAR_BLOCK_KINDS)[number]

export const RECURRENCE_FREQUENCIES = ['none', 'daily', 'weekly'] as const
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number]

export const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const
export type WeekdayCode = (typeof WEEKDAY_CODES)[number]

export type CalendarBlockSeries = {
  id: string
  practiceId: string
  providerId: string | null
  kind: string
  title: string
  notes: string | null
  startTime: Date
  endTime: Date
  timezone: string
  recurrenceFrequency: string
  recurrenceInterval: number
  recurrenceByDay: string[]
  recurrenceUntil: Date | null
  recurrenceCount: number | null
  exceptionDates: Date[]
}

export type CalendarBlockOccurrence = {
  blockId: string
  practiceId: string
  providerId: string | null
  kind: CalendarBlockKind
  title: string
  notes: string | null
  startTime: Date
  endTime: Date
  timezone: string
  isRecurring: boolean
  /** Local calendar date of this occurrence (YYYY-MM-DD in block timezone) */
  occurrenceDate: string
  series: {
    recurrenceFrequency: RecurrenceFrequency
    recurrenceInterval: number
    recurrenceByDay: string[]
    recurrenceUntil: string | null
    recurrenceCount: number | null
  }
}

export type BlockingInterval = {
  blockId: string
  startTime: Date
  endTime: Date
  providerId: string | null
  kind: string
  title: string
}
