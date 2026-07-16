import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { getPracticeTimeZone } from '@/lib/practice-timezone'

vi.mock('@/lib/db', () => ({
  prisma: {
    practiceSettings: { findUnique: vi.fn() },
    practice: { findUnique: vi.fn() },
  },
}))

describe('getPracticeTimeZone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefers Hours of Operation timezone over Brand Profile', async () => {
    vi.mocked(prisma.practiceSettings.findUnique).mockResolvedValue({
      hoursOfOperation: { timezone: 'America/Denver', days: {}, lunch: {} },
    } as never)
    vi.mocked(prisma.practice.findUnique).mockResolvedValue({
      brandProfile: { timezone: 'America/New_York' },
    } as never)

    await expect(getPracticeTimeZone('p1')).resolves.toBe('America/Denver')
  })

  it('falls back to Brand Profile when Hours of Operation has no timezone', async () => {
    vi.mocked(prisma.practiceSettings.findUnique).mockResolvedValue({
      hoursOfOperation: { days: {}, lunch: {} },
    } as never)
    vi.mocked(prisma.practice.findUnique).mockResolvedValue({
      brandProfile: { timezone: 'America/Los_Angeles' },
    } as never)

    await expect(getPracticeTimeZone('p1')).resolves.toBe('America/Los_Angeles')
  })

  it('falls back to America/Chicago when neither is set', async () => {
    vi.mocked(prisma.practiceSettings.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.practice.findUnique).mockResolvedValue({
      brandProfile: null,
    } as never)

    await expect(getPracticeTimeZone('p1')).resolves.toBe('America/Chicago')
  })
})
