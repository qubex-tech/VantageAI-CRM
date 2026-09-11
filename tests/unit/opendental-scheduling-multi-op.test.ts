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

  it('returns the union of start times across configured operatories', async () => {
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

    const list = vi.fn().mockResolvedValue([])
    vi.mocked(getOpenDentalServices).mockResolvedValue({
      appointments: { getSlots },
      schedules: { list },
    } as never)

    const merged = await getOpenDentalOpenSlotsForOperatories({
      practiceId: 'practice-1',
      provNum: 24,
      opNums: [1, 2],
      dateStart: '2026-07-03',
      lengthMinutes: 30,
      operatoryMatch: 'any',
    })

    expect(getSlots).toHaveBeenCalledTimes(2)
    // Blockouts load once for the range, not once per operatory.
    expect(list).toHaveBeenCalledTimes(1)
    expect(merged).toHaveLength(2)
    expect(merged.map((s) => s.start)).toEqual([
      '2026-07-03 14:00:00',
      '2026-07-03 15:00:00',
    ])
    // Shared start prefers the earliest configured operatory.
    expect(merged[0].opNum).toBe(1)
    expect(merged[1].opNum).toBe(2)
  })

  it('intersects starts when operatoryMatch is all (AND)', async () => {
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
          {
            DateTimeStart: '2026-07-03 14:30:00',
            DateTimeEnd: '2026-07-03 15:00:00',
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
        ]
      }
      return []
    })

    vi.mocked(getOpenDentalServices).mockResolvedValue({
      appointments: { getSlots },
      schedules: { list: vi.fn().mockResolvedValue([]) },
    } as never)

    const merged = await getOpenDentalOpenSlotsForOperatories({
      practiceId: 'practice-1',
      provNum: 24,
      opNums: [1, 2],
      dateStart: '2026-07-03',
      lengthMinutes: 30,
      operatoryMatch: 'all',
    })

    // 14:00 free on both; 14:30 only on OP-1 → excluded under AND.
    expect(merged.map((s) => s.start)).toEqual(['2026-07-03 14:00:00'])
    expect(merged[0].opNum).toBe(1)
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
      schedules: { list: vi.fn().mockResolvedValue([]) },
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
      schedules: { list: vi.fn().mockResolvedValue([]) },
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

  it('intersects leftover ranges before slicing so 3:00 and 5:00 survive all-match', async () => {
    const getSlots = vi.fn().mockImplementation(async (query: Record<string, unknown>) => {
      const op = Number(query.OpNum)
      if (op === 1) {
        return [
          {
            DateTimeStart: '2026-09-10 14:50:00',
            DateTimeEnd: '2026-09-10 15:30:00',
            ProvNum: 24,
            OpNum: 1,
          },
          {
            DateTimeStart: '2026-09-10 17:00:00',
            DateTimeEnd: '2026-09-10 18:00:00',
            ProvNum: 24,
            OpNum: 1,
          },
        ]
      }
      if (op === 2) {
        return [
          {
            DateTimeStart: '2026-09-10 15:00:00',
            DateTimeEnd: '2026-09-10 16:00:00',
            ProvNum: 24,
            OpNum: 2,
          },
          {
            DateTimeStart: '2026-09-10 17:00:00',
            DateTimeEnd: '2026-09-10 18:00:00',
            ProvNum: 24,
            OpNum: 2,
          },
        ]
      }
      return []
    })

    vi.mocked(getOpenDentalServices).mockResolvedValue({
      appointments: { getSlots },
      schedules: {
        list: vi.fn().mockResolvedValue([
          {
            SchedType: 'Blockout',
            SchedDate: '2026-09-10',
            StartTime: '17:30:00',
            StopTime: '18:30:00',
            operatories: '1,2',
            Note: 'DR LEAVE AT 5:30PM',
          },
        ]),
      },
    } as never)

    const merged = await getOpenDentalOpenSlotsForOperatories({
      practiceId: 'practice-1',
      provNum: 24,
      opNums: [1, 2],
      dateStart: '2026-09-10',
      lengthMinutes: 30,
      operatoryMatch: 'all',
    })

    expect(merged.map((s) => s.start)).toEqual([
      '2026-09-10 15:00:00',
      '2026-09-10 17:00:00',
    ])
    expect(merged[0].opNum).toBe(1)
  })

  it('clock-aligns a leftover single-chair hole so 2:50–3:30 yields 3:00', async () => {
    const getSlots = vi.fn().mockResolvedValue([
      {
        DateTimeStart: '2026-09-10 14:50:00',
        DateTimeEnd: '2026-09-10 15:30:00',
        ProvNum: 24,
        OpNum: 1,
      },
    ])
    vi.mocked(getOpenDentalServices).mockResolvedValue({
      appointments: { getSlots },
      schedules: { list: vi.fn().mockResolvedValue([]) },
    } as never)

    const merged = await getOpenDentalOpenSlotsForOperatories({
      practiceId: 'practice-1',
      provNum: 24,
      opNums: [1],
      dateStart: '2026-09-10',
      lengthMinutes: 30,
    })

    expect(merged.map((s) => s.start)).toEqual(['2026-09-10 15:00:00'])
  })
})
