import { describe, expect, it } from 'vitest'
import { parseOutboundAgentsSettings } from '@/lib/appointment-optimization/settings'
import { getLookAheadWindow } from '@/lib/business-days'

describe('slot fill rules parsing', () => {
  it('parses look-ahead start/end range and wave interval', () => {
    const settings = parseOutboundAgentsSettings({
      masterEnabled: true,
      appointmentOptimizationEnabled: true,
      waveIntervalMinutes: 15,
      slotFillRules: [
        {
          id: 'rule-1',
          visitType: 'Follow Up Visit',
          bufferBusinessDays: 3,
          lookAheadStartBusinessDays: 7,
          lookAheadEndBusinessDays: 14,
          enabled: true,
        },
      ],
    })
    expect(settings.waveIntervalMinutes).toBe(15)
    expect(settings.slotFillRules).toHaveLength(1)
    expect(settings.slotFillRules?.[0]).toMatchObject({
      visitType: 'Follow Up Visit',
      bufferBusinessDays: 3,
      lookAheadStartBusinessDays: 7,
      lookAheadEndBusinessDays: 14,
    })
  })

  it('migrates legacy lookAheadBusinessDays into start=1 / end=legacy', () => {
    const settings = parseOutboundAgentsSettings({
      slotFillRules: [
        {
          id: 'rule-1',
          visitType: 'Consultation',
          bufferBusinessDays: 2,
          lookAheadBusinessDays: 14,
        },
      ],
    })
    expect(settings.slotFillRules?.[0]).toMatchObject({
      lookAheadStartBusinessDays: 1,
      lookAheadEndBusinessDays: 14,
    })
  })

  it('skips rules without visit type', () => {
    const settings = parseOutboundAgentsSettings({
      slotFillRules: [
        {
          id: 'x',
          visitType: '',
          bufferBusinessDays: 2,
          lookAheadStartBusinessDays: 7,
          lookAheadEndBusinessDays: 14,
        },
      ],
    })
    expect(settings.slotFillRules).toHaveLength(0)
  })

  it('clamps day counts and swaps inverted start/end', () => {
    const settings = parseOutboundAgentsSettings({
      slotFillRules: [
        {
          id: 'x',
          visitType: 'NP',
          bufferBusinessDays: 0,
          lookAheadStartBusinessDays: 20,
          lookAheadEndBusinessDays: 10,
        },
      ],
      waveIntervalMinutes: 0,
    })
    expect(settings.slotFillRules?.[0]?.bufferBusinessDays).toBe(1)
    expect(settings.slotFillRules?.[0]?.lookAheadStartBusinessDays).toBe(10)
    expect(settings.slotFillRules?.[0]?.lookAheadEndBusinessDays).toBe(10)
    expect(settings.waveIntervalMinutes).toBe(1)
  })
})

describe('getLookAheadWindow', () => {
  it('builds calendar-day start/end from the open slot', () => {
    // Friday Jul 10, 2026 → engage patients booked Jul 17 through Jul 24
    const slotStart = new Date('2026-07-10T14:00:00.000Z')
    const { lookAheadStart, lookAheadEnd } = getLookAheadWindow(
      slotStart,
      7,
      14,
      'America/Chicago'
    )
    expect(lookAheadStart.toISOString().slice(0, 10)).toBe('2026-07-17')
    // End-of-day helper returns last ms before next calendar day anchor
    expect(lookAheadEnd.getTime()).toBeGreaterThan(new Date('2026-07-24T23:00:00.000Z').getTime())
    expect(lookAheadEnd.getTime()).toBeLessThan(new Date('2026-07-26T00:00:00.000Z').getTime())
  })
})
