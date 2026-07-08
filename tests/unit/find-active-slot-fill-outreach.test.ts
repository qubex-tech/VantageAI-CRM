import { describe, expect, it } from 'vitest'
import { canAcceptSlotFillReply } from '@/lib/appointment-optimization/findActiveSlotFillOutreach'

describe('canAcceptSlotFillReply', () => {
  const futureSlot = new Date(Date.now() + 60 * 60 * 1000)

  it('accepts replies while the slot is still unfilled in the future', () => {
    expect(
      canAcceptSlotFillReply({
        slotStart: futureSlot,
        slotUnfilled: true,
        appointmentId: 'appt-1',
        appointmentStatus: 'confirmed',
      })
    ).toBe(true)
  })

  it('ignores stale exhausted status when occupancy check says unfilled', () => {
    expect(
      canAcceptSlotFillReply({
        slotStart: futureSlot,
        slotUnfilled: true,
        appointmentId: 'appt-1',
        appointmentStatus: 'confirmed',
      })
    ).toBe(true)
  })

  it('rejects replies once the slot window is actually occupied', () => {
    expect(
      canAcceptSlotFillReply({
        slotStart: futureSlot,
        slotUnfilled: false,
        appointmentId: 'appt-1',
        appointmentStatus: 'confirmed',
      })
    ).toBe(false)
  })

  it('rejects replies after the slot time passes', () => {
    expect(
      canAcceptSlotFillReply({
        slotStart: new Date(Date.now() - 1000),
        slotUnfilled: true,
        appointmentId: 'appt-1',
        appointmentStatus: 'confirmed',
      })
    ).toBe(false)
  })
})
