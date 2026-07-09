import { prisma } from '@/lib/db'
import {
  DEFAULT_DAY_CLOSED,
  DEFAULT_DAY_OPEN,
  DEFAULT_HOURS_OF_OPERATION,
  DEFAULT_LUNCH,
  WEEKDAY_KEYS,
  type DayHours,
  type HoursOfOperationSettings,
  type LunchHours,
  type WeekdayKey,
} from '@/lib/practice-hours/types'

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/

function parseTime(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !HH_MM.test(value)) return fallback
  return value
}

function parseDayHours(value: unknown, fallback: DayHours): DayHours {
  if (!value || typeof value !== 'object') return { ...fallback }
  const raw = value as Record<string, unknown>
  const open = parseTime(raw.open, fallback.open)
  let close = parseTime(raw.close, fallback.close)
  if (close <= open) close = fallback.close
  const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled
  return { enabled, open, close }
}

function parseLunch(value: unknown): LunchHours {
  if (!value || typeof value !== 'object') return { ...DEFAULT_LUNCH }
  const raw = value as Record<string, unknown>
  const start = parseTime(raw.start, DEFAULT_LUNCH.start)
  let end = parseTime(raw.end, DEFAULT_LUNCH.end)
  if (end <= start) end = DEFAULT_LUNCH.end
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_LUNCH.enabled,
    start,
    end,
  }
}

export function parseHoursOfOperationSettings(value: unknown): HoursOfOperationSettings {
  if (!value || typeof value !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_HOURS_OF_OPERATION)) as HoursOfOperationSettings
  }
  const raw = value as Record<string, unknown>
  const daysRaw =
    raw.days && typeof raw.days === 'object' ? (raw.days as Record<string, unknown>) : {}

  const days = {} as Record<WeekdayKey, DayHours>
  for (const key of WEEKDAY_KEYS) {
    const isWeekend = key === 'saturday' || key === 'sunday'
    const fallback = isWeekend ? DEFAULT_DAY_CLOSED : DEFAULT_DAY_OPEN
    days[key] = parseDayHours(daysRaw[key], fallback)
  }

  return {
    days,
    lunch: parseLunch(raw.lunch),
  }
}

export async function getHoursOfOperationSettings(
  practiceId: string
): Promise<HoursOfOperationSettings> {
  const row = await prisma.practiceSettings.findUnique({
    where: { practiceId },
    select: { hoursOfOperation: true },
  })
  return parseHoursOfOperationSettings(row?.hoursOfOperation)
}

export async function saveHoursOfOperationSettings(
  practiceId: string,
  settings: HoursOfOperationSettings
) {
  const normalized = parseHoursOfOperationSettings(settings)
  return prisma.practiceSettings.upsert({
    where: { practiceId },
    create: {
      practiceId,
      hoursOfOperation: normalized,
    },
    update: {
      hoursOfOperation: normalized,
    },
  })
}
