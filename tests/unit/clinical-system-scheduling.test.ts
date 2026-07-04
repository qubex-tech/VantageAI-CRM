import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { getSchedulingSettings } from '@/lib/integrations/clinical-system/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    practiceSettings: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/integrations/opendental/factory', () => ({
  getOpenDentalConnection: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/integrations/ehr/server', () => ({
  getEhrSettings: vi.fn().mockResolvedValue(null),
}))

describe('getSchedulingSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses multi-operatory scheduling fields from practice settings', async () => {
    vi.mocked(prisma.practiceSettings.findUnique).mockResolvedValue({
      practiceId: 'practice-1',
      clinicalIntegrations: {
        system: 'open_dental',
        scheduling: {
          mode: 'open_dental',
          defaultReadOperatoryNum: 1,
          defaultReadOperatoryNums: [3, 3, 4],
          defaultOperatoryNum: 2,
          defaultOperatoryNums: [5],
          defaultLengthMinutes: 30,
        },
      },
    } as never)

    const settings = await getSchedulingSettings('practice-1')

    expect(settings.mode).toBe('open_dental')
    expect(settings.readSource).toBe('open_dental')
    expect(settings.writeSource).toBe('open_dental')
    expect(settings.defaultReadOperatoryNum).toBe(1)
    expect(settings.defaultReadOperatoryNums).toEqual([3, 4])
    expect(settings.defaultOperatoryNum).toBe(2)
    expect(settings.defaultOperatoryNums).toEqual([5])
  })

  it('defaults to cal mode when scheduling is missing', async () => {
    vi.mocked(prisma.practiceSettings.findUnique).mockResolvedValue({
      practiceId: 'practice-1',
      clinicalIntegrations: { system: 'open_dental' },
    } as never)

    const settings = await getSchedulingSettings('practice-1')
    expect(settings).toEqual({
      mode: 'cal',
      readSource: 'cal',
      writeSource: 'cal',
    })
  })
})
