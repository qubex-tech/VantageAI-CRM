import { prisma } from '@/lib/db'
import { DEFAULT_PRACTICE_TIMEZONE, normalizeTimeZone } from '@/lib/timezone'

export async function getPracticeTimeZone(practiceId: string): Promise<string> {
  const practice = await prisma.practice.findUnique({
    where: { id: practiceId },
    select: { brandProfile: { select: { timezone: true } } },
  })
  return normalizeTimeZone(practice?.brandProfile?.timezone) ?? DEFAULT_PRACTICE_TIMEZONE
}
