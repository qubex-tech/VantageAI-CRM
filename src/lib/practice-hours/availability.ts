import { zonedDateKey, zonedLocalToUtc } from '@/lib/calendar/expandCalendarBlocks'
import { getHoursOfOperationSettings } from '@/lib/practice-hours/settings'
import {
  WEEKDAY_KEYS,
  type DayHours,
  type HoursOfOperationSettings,
  type WeekdayKey,
} from '@/lib/practice-hours/types'
import { getPracticeTimeZone } from '@/lib/practice-timezone'

const WEEKDAY_SHORT_TO_KEY: Record<string, WeekdayKey> = {
  Mon: 'monday',
  Tue: 'tuesday',
  Wed: 'wednesday',
  Thu: 'thursday',
  Fri: 'friday',
  Sat: 'saturday',
  Sun: 'sunday',
}

function parseHhMm(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map(Number)
  return { hour: hour || 0, minute: minute || 0 }
}

function weekdayKeyForInstant(date: Date, timeZone: string): WeekdayKey {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(date)
  return WEEKDAY_SHORT_TO_KEY[short] ?? 'monday'
}

function localWindowOnDate(
  dateKey: string,
  hhmm: string,
  timeZone: string
): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const { hour, minute } = parseHhMm(hhmm)
  return zonedLocalToUtc(year, month, day, hour, minute, 0, timeZone)
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * Returns null when the slot is fully within operating hours and outside lunch.
 * Otherwise returns a skip reason for slot-fill.
 */
export function getSlotHoursViolation(
  settings: HoursOfOperationSettings,
  slotStart: Date,
  slotEnd: Date,
  timeZone: string
): 'outside_hours_of_operation' | 'during_lunch' | null {
  if (slotEnd <= slotStart) return 'outside_hours_of_operation'

  const startKey = zonedDateKey(slotStart, timeZone)
  const endKey = zonedDateKey(new Date(slotEnd.getTime() - 1), timeZone)

  // Multi-day slots are not offered for slot-fill under practice hours
  if (startKey !== endKey) {
    return 'outside_hours_of_operation'
  }

  const dayKey = weekdayKeyForInstant(slotStart, timeZone)
  const day: DayHours = settings.days[dayKey] ?? { enabled: false, open: '09:00', close: '17:00' }

  if (!day.enabled) {
    return 'outside_hours_of_operation'
  }

  const openAt = localWindowOnDate(startKey, day.open, timeZone)
  const closeAt = localWindowOnDate(startKey, day.close, timeZone)

  if (slotStart < openAt || slotEnd > closeAt) {
    return 'outside_hours_of_operation'
  }

  if (settings.lunch.enabled) {
    const lunchStart = localWindowOnDate(startKey, settings.lunch.start, timeZone)
    const lunchEnd = localWindowOnDate(startKey, settings.lunch.end, timeZone)
    if (lunchEnd > lunchStart && intervalsOverlap(slotStart, slotEnd, lunchStart, lunchEnd)) {
      return 'during_lunch'
    }
  }

  return null
}

export async function getSlotHoursViolationForPractice(params: {
  practiceId: string
  slotStart: Date
  slotEnd: Date
  timeZone?: string
}): Promise<'outside_hours_of_operation' | 'during_lunch' | null> {
  const [settings, timeZone] = await Promise.all([
    getHoursOfOperationSettings(params.practiceId),
    params.timeZone
      ? Promise.resolve(params.timeZone)
      : getPracticeTimeZone(params.practiceId),
  ])
  return getSlotHoursViolation(settings, params.slotStart, params.slotEnd, timeZone)
}

/** True when settings look intentionally configured (any open day). */
export function hasConfiguredOpenDays(settings: HoursOfOperationSettings): boolean {
  return WEEKDAY_KEYS.some((key) => settings.days[key]?.enabled)
}
