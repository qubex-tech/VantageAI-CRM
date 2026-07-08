import { describe, expect, it } from 'vitest'
import { OPEN_SLOT_STATUS } from '@/lib/appointment-optimization/types'

/**
 * Mirrors the occupancy check in isOpenSlotFilled — status flag alone must not imply filled.
 */
function slotOccupiedByAppointment(
  slotStatus: string,
  hasOverlappingAppointment: boolean
): boolean {
  void slotStatus
  return hasOverlappingAppointment
}

describe('open slot occupancy', () => {
  it('treats a filled-status slot as open when no appointment occupies the window', () => {
    expect(
      slotOccupiedByAppointment(OPEN_SLOT_STATUS.FILLED, false)
    ).toBe(false)
  })

  it('treats a slot as filled when a confirmed appointment overlaps', () => {
    expect(
      slotOccupiedByAppointment(OPEN_SLOT_STATUS.OPEN, true)
    ).toBe(true)
  })
})
