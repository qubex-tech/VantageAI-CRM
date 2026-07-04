import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOpenDentalOpenSlotsForOperatories } from '@/lib/integrations/opendental/scheduling'
import { getOpenDentalServices } from '@/lib/integrations/opendental/factory'

vi.mock('@/lib/integrations/opendental/factory', () => ({
  getOpenDentalServices: vi.fn(),
}))

vi.mock('@/lib/practice-timezone', () => ({
  getPracticeTimeZone: vi.fn().mockResolvedValue('America/Chicago'),
}))

describe('getOpenDentalOpenSlotsForOperatories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns only start times open on every configured operatory', async () => {
    const getSlots = vi.fn().mockImplementation(async (query: Record<string, unknown>) => {
      const op = Number(query.OpNum)
      if (op === 1) {
        return [
          {
            DateTimeStart: '2026-07-03 14:00:00',
            DateTimeEnd: '2026-07-03 14:30:00',
            ProvNum: 24,
            OpNum: 1,
          },
        ]
      }
      if (op === 2) {
        return [
          {
            DateTimeStart: '2026-07-03 14:00:00',
            DateTimeEnd: '2026-07-03 14:30:00',
            ProvNum: 24,
            OpNum: 2,
          },
          {
            DateTimeStart: '2026-07-03 15:00:00',
            DateTimeEnd: '2026-07-03 15:30:00',
            ProvNum: 24,
            OpNum: 2,
          },
        ]
      }
      return []
    })

    vi.mocked(getOpenDentalServices).mockResolvedValue({
      appointments: { getSlots },
    } as never)

    const merged = await getOpenDentalOpenSlotsForOperatories({
      practiceId: 'practice-1',
      provNum: 24,
      opNums: [1, 2],
      dateStart: '2026-07-03',
      lengthMinutes: 30,
    })

    expect(getSlots).toHaveBeenCalledTimes(2)
    expect(merged).toHaveLength(1)
    expect(merged[0].start).toBe('2026-07-03 14:00:00')
    expect(merged[0].opNum).toBe(2)
  })

  it('returns all slots when only one operatory is configured', async () => {
    const getSlots = vi.fn().mockResolvedValue([
      {
        DateTimeStart: '2026-07-03 15:00:00',
        DateTimeEnd: '2026-07-03 15:30:00',
        ProvNum: 24,
        OpNum: 2,
      },
    ])

    vi.mocked(getOpenDentalServices).mockResolvedValue({
      appointments: { getSlots },
    } as never)

    const merged = await getOpenDentalOpenSlotsForOperatories({
      practiceId: 'practice-1',
      provNum: 24,
      opNums: [2],
      dateStart: '2026-07-03',
      lengthMinutes: 30,
    })

    expect(getSlots).toHaveBeenCalledTimes(1)
    expect(merged).toHaveLength(1)
    expect(merged[0].start).toBe('2026-07-03 15:00:00')
  })

  it('queries without OpNum when no operatories are configured', async () => {
    const getSlots = vi.fn().mockResolvedValue([])
    vi.mocked(getOpenDentalServices).mockResolvedValue({
      appointments: { getSlots },
    } as never)

    await getOpenDentalOpenSlotsForOperatories({
      practiceId: 'practice-1',
      opNums: [],
      dateStart: '2026-07-03',
    })

    expect(getSlots).toHaveBeenCalledWith(
      expect.not.objectContaining({ OpNum: expect.anything() })
    )
  })
})
