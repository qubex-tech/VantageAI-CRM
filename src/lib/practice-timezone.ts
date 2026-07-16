import { prisma } from '@/lib/db'
import { extractHoursOfOperationTimezone } from '@/lib/practice-hours/settings'
import { DEFAULT_PRACTICE_TIMEZONE, normalizeTimeZone } from '@/lib/timezone'

/**
 * Resolve the practice's clinic timezone.
 * Prefer Hours of Operation (Settings) over Brand Profile (Marketing), then default.
 */
export async function getPracticeTimeZone(practiceId: string): Promise<string> {
  const [settingsRow, practice] = await Promise.all([
    prisma.practiceSettings.findUnique({
      where: { practiceId },
      select: { hoursOfOperation: true },
    }),
    prisma.practice.findUnique({
      where: { id: practiceId },
      select: { brandProfile: { select: { timezone: true } } },
    }),
  ])

  const fromHours = extractHoursOfOperationTimezone(settingsRow?.hoursOfOperation)
  if (fromHours) return fromHours

  return normalizeTimeZone(practice?.brandProfile?.timezone) ?? DEFAULT_PRACTICE_TIMEZONE
}
