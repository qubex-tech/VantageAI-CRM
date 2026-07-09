import { getLookAheadEnd, isWithinBufferWindow } from '@/lib/business-days'
import { createOpenSlotEvent } from '@/lib/appointment-optimization/openSlotEvents'
import { markOpenTimeSlotProcessed } from '@/lib/appointment-optimization/openSlotInventory'
import {
  getOutboundAgentsSettings,
  getSlotFillRuleForVisitType,
  isAppointmentOptimizationEnabled,
} from '@/lib/appointment-optimization/settings'
import type { OpenSlotEventMetadata, OpenTimeSlot } from '@/lib/appointment-optimization/types'
import { slotOverlapsCalendarBlock } from '@/lib/calendar/blockingIntervals'
import { getSlotHoursViolationForPractice } from '@/lib/practice-hours/availability'
import { getPracticeTimeZone } from '@/lib/practice-timezone'

export type EvaluateOpenTimeSlotResult = {
  action: 'skipped' | 'outreach_started'
  reason?: string
  openSlotEventId?: string
}

/**
 * Source-agnostic rules engine: applies visit-type + buffer + look-ahead settings.
 * Does not call EHR, Cal.com, or Open Dental APIs.
 */
export async function evaluateOpenTimeSlot(
  slot: OpenTimeSlot
): Promise<EvaluateOpenTimeSlotResult> {
  const settings = await getOutboundAgentsSettings(slot.practiceId)
  if (!isAppointmentOptimizationEnabled(settings)) {
    await markInventorySkipped(slot, 'agent_disabled')
    return { action: 'skipped', reason: 'agent_disabled' }
  }

  const rule = getSlotFillRuleForVisitType(settings, slot.visitType)
  if (!rule) {
    await markInventorySkipped(slot, 'no_matching_rule')
    return { action: 'skipped', reason: 'no_matching_rule' }
  }

  const timeZone = await getPracticeTimeZone(slot.practiceId)
  const now = new Date()

  if (slot.start <= now) {
    await markInventorySkipped(slot, 'slot_in_past')
    return { action: 'skipped', reason: 'slot_in_past' }
  }

  if (
    await slotOverlapsCalendarBlock({
      practiceId: slot.practiceId,
      slotStart: slot.start,
      slotEnd: slot.end,
      providerId: slot.providerId,
    })
  ) {
    await markInventorySkipped(slot, 'blocked_by_calendar_block')
    return { action: 'skipped', reason: 'blocked_by_calendar_block' }
  }

  const hoursViolation = await getSlotHoursViolationForPractice({
    practiceId: slot.practiceId,
    slotStart: slot.start,
    slotEnd: slot.end,
    timeZone,
  })
  if (hoursViolation) {
    await markInventorySkipped(slot, hoursViolation)
    return { action: 'skipped', reason: hoursViolation }
  }

  if (!isWithinBufferWindow(slot.start, rule.bufferBusinessDays, timeZone, now)) {
    await markInventorySkipped(slot, 'outside_buffer')
    return { action: 'skipped', reason: 'outside_buffer' }
  }

  const lookAheadEnd = getLookAheadEnd(slot.start, rule.lookAheadBusinessDays, timeZone)
  const metadata: OpenSlotEventMetadata = {
    slotFillRuleId: rule.id,
    lookAheadEnd: lookAheadEnd.toISOString(),
    bufferBusinessDays: rule.bufferBusinessDays,
    lookAheadBusinessDays: rule.lookAheadBusinessDays,
  }

  const result = await createOpenSlotEvent({
    practiceId: slot.practiceId,
    providerId: slot.providerId,
    appointmentType: slot.visitType,
    slotStart: slot.start,
    slotEnd: slot.end,
    source: slot.openSlotSource ?? 'availability',
    sourceAppointmentId: slot.sourceAppointmentId ?? null,
    metadata,
  })

  if (!result.created) {
    await markInventoryProcessed(slot, result.openSlotEventId, 'skipped')
    return {
      action: 'skipped',
      reason: result.reason ?? 'not_created',
      openSlotEventId: result.openSlotEventId,
    }
  }

  await markInventoryProcessed(slot, result.openSlotEventId, 'processed')
  return {
    action: 'outreach_started',
    openSlotEventId: result.openSlotEventId,
  }
}

async function markInventorySkipped(slot: OpenTimeSlot, _reason: string) {
  if (!slot.inventoryId) return
  await markOpenTimeSlotProcessed(slot.inventoryId, { status: 'skipped' })
}

async function markInventoryProcessed(
  slot: OpenTimeSlot,
  openSlotEventId: string | undefined,
  status: 'processed' | 'skipped'
) {
  if (!slot.inventoryId) return
  await markOpenTimeSlotProcessed(slot.inventoryId, {
    status,
    openSlotEventId,
  })
}
