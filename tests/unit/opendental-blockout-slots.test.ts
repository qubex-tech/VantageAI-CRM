import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  eachDateInRange,
  filterOpenDentalSlotsAgainstBlockouts,
  getOpenDentalOpenSlots,
  openDentalSlotOverlapsBlockout,
  type OpenDentalBlockout,
  type OpenDentalOpenSlot,
} from '@/lib/integrations/opendental/scheduling'
import { getOpenDentalServices } from '@/lib/integrations/opendental/factory'

vi.mock('@/lib/integrations/opendental/factory', () => ({
  getOpenDentalServices: vi.fn(),
}))

vi.mock('@/lib/practice-timezone', () => ({
  getPracticeTimeZone: vi.fn().mockResolvedValue('America/Chicago'),
}))

describe('Open Dental blockout slot filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enumerates inclusive date ranges', () => {
    expect(eachDateInRange('2026-07-23', '2026-07-23')).toEqual(['2026-07-23'])
    expect(eachDateInRange('2026-07-22', '2026-07-24')).toEqual([
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
    ])
  })

  it('detects overlap for Kelly-style General Blockout on matching ops', () => {
    const blockout: OpenDentalBlockout = {
      start: '2026-07-23 11:50:00',
      end: '2026-07-23 18:30:00',
      opNums: [2, 1],
      note: 'kelly will not be here. kw',
      blockoutType: 241,
    }

    expect(
      openDentalSlotOverlapsBlockout(
        { start: '2026-07-23 14:00:00', opNum: 2, lengthMinutes: 30 },
        blockout
      )
    ).toBe(true)
    expect(
      openDentalSlotOverlapsBlockout(
        { start: '2026-07-23 17:30:00', opNum: 1, lengthMinutes: 30 },
        blockout
      )
    ).toBe(true)
    // Morning slot before the blockout window stays open.
    expect(
      openDentalSlotOverlapsBlockout(
        { start: '2026-07-23 09:00:00', opNum: 2, lengthMinutes: 30 },
        blockout
      )
    ).toBe(false)
    // Different operatory is unaffected.
    expect(
      openDentalSlotOverlapsBlockout(
        { start: '2026-07-23 14:00:00', opNum: 3, lengthMinutes: 30 },
        blockout
      )
    ).toBe(false)
  })

  it('treats empty opNums as blocking every operatory', () => {
    const blockout: OpenDentalBlockout = {
      start: '2026-07-23 12:00:00',
      end: '2026-07-23 13:00:00',
      opNums: [],
      note: null,
      blockoutType: 241,
    }
    expect(
      openDentalSlotOverlapsBlockout(
        { start: '2026-07-23 12:15:00', opNum: 9, lengthMinutes: 30 },
        blockout
      )
    ).toBe(true)
  })

  it('filters afternoon slots when Slots API ignores a daytime blockout', () => {
    const slots: OpenDentalOpenSlot[] = [
      {
        start: '2026-07-23 09:00:00',
        startUtc: '2026-07-23T14:00:00.000Z',
        provNum: 24,
        opNum: 2,
        lengthMinutes: 30,
      },
      {
        start: '2026-07-23 14:00:00',
        startUtc: '2026-07-23T19:00:00.000Z',
        provNum: 24,
        opNum: 2,
        lengthMinutes: 30,
      },
      {
        start: '2026-07-23 17:30:00',
        startUtc: '2026-07-23T22:30:00.000Z',
        provNum: 24,
        opNum: 2,
        lengthMinutes: 30,
      },
    ]
    const blockouts: OpenDentalBlockout[] = [
      {
        start: '2026-07-23 11:50:00',
        end: '2026-07-23 18:30:00',
        opNums: [1, 2],
        note: 'kelly will not be here. kw',
        blockoutType: 241,
      },
    ]

    const filtered = filterOpenDentalSlotsAgainstBlockouts(slots, blockouts)
    expect(filtered.map((s) => s.start)).toEqual(['2026-07-23 09:00:00'])
  })

  it('returns zero slots when getSlots range is fully covered by a blockout', async () => {
    const getSlots = vi.fn().mockResolvedValue([
      {
        DateTimeStart: '2026-07-23 14:00:00',
        DateTimeEnd: '2026-07-23 18:00:00',
        ProvNum: 24,
        OpNum: 2,
      },
    ])
    const list = vi.fn().mockResolvedValue([
      {
        ScheduleNum: '21246',
        SchedType: 'Blockout',
        SchedDate: '2026-07-23',
        StartTime: '11:50:00',
        StopTime: '18:30:00',
        ProvNum: '0',
        BlockoutType: '241',
        Note: 'kelly will not be here. kw',
        operatories: '2,1',
      },
      {
        SchedType: 'Provider',
        SchedDate: '2026-07-23',
        StartTime: '14:00:00',
        StopTime: '18:00:00',
        ProvNum: '24',
        operatories: '1,2',
      },
    ])

    vi.mocked(getOpenDentalServices).mockResolvedValue({
      appointments: { getSlots },
      schedules: { list },
    } as never)

    const slots = await getOpenDentalOpenSlots({
      practiceId: 'practice-1',
      provNum: 24,
      opNum: 2,
      dateStart: '2026-07-23',
      lengthMinutes: 30,
    })

    expect(getSlots).toHaveBeenCalled()
    expect(list).toHaveBeenCalledWith({ date: '2026-07-23' })
    expect(slots).toEqual([])
  })

  it('returns unfiltered slots when schedules.list fails', async () => {
    const getSlots = vi.fn().mockResolvedValue([
      {
        DateTimeStart: '2026-07-23 14:00:00',
        DateTimeEnd: '2026-07-23 14:30:00',
        ProvNum: 24,
        OpNum: 2,
      },
    ])
    const list = vi.fn().mockRejectedValue(new Error('schedules unavailable'))

    vi.mocked(getOpenDentalServices).mockResolvedValue({
      appointments: { getSlots },
      schedules: { list },
    } as never)

    const slots = await getOpenDentalOpenSlots({
      practiceId: 'practice-1',
      opNum: 2,
      dateStart: '2026-07-23',
      lengthMinutes: 30,
    })

    expect(slots).toHaveLength(1)
    expect(slots[0].start).toBe('2026-07-23 14:00:00')
  })

  it('fetches blockout days concurrently across a multi-day window', async () => {
    const { listOpenDentalBlockouts } = await import('@/lib/integrations/opendental/scheduling')
    let inFlight = 0
    let maxInFlight = 0
    const list = vi.fn().mockImplementation(async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 20))
      inFlight--
      return []
    })

    vi.mocked(getOpenDentalServices).mockResolvedValue({
      appointments: { getSlots: vi.fn() },
      schedules: { list },
    } as never)

    await listOpenDentalBlockouts({
      practiceId: 'practice-1',
      dateStart: '2026-07-23',
      dateEnd: '2026-07-30',
    })

    expect(list).toHaveBeenCalledTimes(8)
    // Sequential would keep maxInFlight at 1.
    expect(maxInFlight).toBeGreaterThan(1)
  })
})
