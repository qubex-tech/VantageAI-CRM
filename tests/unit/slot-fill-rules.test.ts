import { describe, expect, it } from 'vitest'
import { parseOutboundAgentsSettings } from '@/lib/appointment-optimization/settings'

describe('slot fill rules parsing', () => {
  it('parses valid slot fill rules from outbound agents settings', () => {
    const settings = parseOutboundAgentsSettings({
      masterEnabled: true,
      appointmentOptimizationEnabled: true,
      slotFillRules: [
        {
          id: 'rule-1',
          visitType: 'Follow Up Visit',
          bufferBusinessDays: 3,
          lookAheadBusinessDays: 14,
          enabled: true,
        },
      ],
    })
    expect(settings.slotFillRules).toHaveLength(1)
    expect(settings.slotFillRules?.[0]).toMatchObject({
      visitType: 'Follow Up Visit',
      bufferBusinessDays: 3,
      lookAheadBusinessDays: 14,
    })
  })

  it('skips rules without visit type', () => {
    const settings = parseOutboundAgentsSettings({
      slotFillRules: [{ id: 'x', visitType: '', bufferBusinessDays: 2, lookAheadBusinessDays: 5 }],
    })
    expect(settings.slotFillRules).toHaveLength(0)
  })

  it('clamps day counts to 1-90', () => {
    const settings = parseOutboundAgentsSettings({
      slotFillRules: [
        {
          id: 'x',
          visitType: 'NP',
          bufferBusinessDays: 0,
          lookAheadBusinessDays: 200,
        },
      ],
    })
    expect(settings.slotFillRules?.[0]?.bufferBusinessDays).toBe(1)
    expect(settings.slotFillRules?.[0]?.lookAheadBusinessDays).toBe(90)
  })
})
