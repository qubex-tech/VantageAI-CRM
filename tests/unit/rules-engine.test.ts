import { describe, expect, it, vi, beforeEach } from 'vitest'
import { evaluateOpenTimeSlot } from '@/lib/appointment-optimization/rulesEngine'
import type { OpenTimeSlot } from '@/lib/appointment-optimization/types'

vi.mock('@/lib/appointment-optimization/settings', () => ({
  getOutboundAgentsSettings: vi.fn(),
  getSlotFillRuleForVisitType: vi.fn(),
  isAppointmentOptimizationEnabled: vi.fn(() => true),
}))

vi.mock('@/lib/practice-timezone', () => ({
  getPracticeTimeZone: vi.fn(async () => 'America/Chicago'),
}))

vi.mock('@/lib/appointment-optimization/openSlotEvents', () => ({
  createOpenSlotEvent: vi.fn(async () => ({
    created: true,
    openSlotEventId: 'evt-1',
  })),
}))

vi.mock('@/lib/appointment-optimization/openSlotInventory', () => ({
  markOpenTimeSlotProcessed: vi.fn(async () => undefined),
}))

vi.mock('@/lib/calendar/blockingIntervals', () => ({
  slotOverlapsCalendarBlock: vi.fn(async () => false),
}))

vi.mock('@/lib/practice-hours/availability', () => ({
  getSlotHoursViolationForPractice: vi.fn(async () => null),
}))

import {
  getOutboundAgentsSettings,
  getSlotFillRuleForVisitType,
  isAppointmentOptimizationEnabled,
} from '@/lib/appointment-optimization/settings'
import { createOpenSlotEvent } from '@/lib/appointment-optimization/openSlotEvents'

describe('rulesEngine.evaluateOpenTimeSlot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isAppointmentOptimizationEnabled).mockReturnValue(true)
    vi.mocked(getOutboundAgentsSettings).mockResolvedValue({
      masterEnabled: true,
      appointmentOptimizationEnabled: true,
      slotFillRules: [],
    })
  })

  it('skips when no matching rule', async () => {
    vi.mocked(getSlotFillRuleForVisitType).mockReturnValue(null)
    const slot: OpenTimeSlot = {
      practiceId: 'p1',
      providerId: null,
      visitType: 'Follow Up Visit',
      start: new Date('2030-01-08T15:00:00.000Z'),
      end: new Date('2030-01-08T15:30:00.000Z'),
    }
    const result = await evaluateOpenTimeSlot(slot)
    expect(result.action).toBe('skipped')
    expect(result.reason).toBe('no_matching_rule')
    expect(createOpenSlotEvent).not.toHaveBeenCalled()
  })

  it('starts outreach when rule matches and slot is in buffer', async () => {
    vi.mocked(getSlotFillRuleForVisitType).mockReturnValue({
      id: 'rule-1',
      visitType: 'Follow Up Visit',
      bufferBusinessDays: 30,
      lookAheadStartBusinessDays: 7,
      lookAheadEndBusinessDays: 14,
      enabled: true,
    })
    const start = new Date()
    start.setDate(start.getDate() + 2)
    const end = new Date(start.getTime() + 30 * 60 * 1000)
    const slot: OpenTimeSlot = {
      practiceId: 'p1',
      providerId: 'prov-1',
      visitType: 'Follow Up Visit',
      start,
      end,
      openSlotSource: 'availability',
    }
    const result = await evaluateOpenTimeSlot(slot)
    expect(result.action).toBe('outreach_started')
    expect(createOpenSlotEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentType: 'Follow Up Visit',
        metadata: expect.objectContaining({
          slotFillRuleId: 'rule-1',
          lookAheadStartBusinessDays: 7,
          lookAheadEndBusinessDays: 14,
        }),
      })
    )
  })
})
