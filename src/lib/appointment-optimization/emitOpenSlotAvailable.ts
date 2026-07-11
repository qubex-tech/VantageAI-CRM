import { emitEvent } from '@/lib/outbox'
import {
  OPEN_SLOT_SOURCE_LABELS,
  type OpenSlotSource,
} from '@/lib/appointment-optimization/types'

export type OpenSlotAvailableEventData = {
  openSlot: {
    id: string
    source: OpenSlotSource
    /** Human-readable scenario label for conditions */
    triggerLabel: string
    /** Same as source — for equals conditions in FlowBuilder */
    triggerScenario: OpenSlotSource
    visitType: string
    providerId: string | null
    slotStart: string
    slotEnd: string
    durationMinutes: number
    sourceAppointmentId: string | null
  }
}

/**
 * Publish automation trigger: Slot Available.
 * Workflows can condition on openSlot.source / triggerLabel and then
 * wait_until_local_time → send_slot_fill_outreach.
 */
export async function emitOpenSlotAvailableEvent(params: {
  practiceId: string
  openSlotEventId: string
  source: string
  visitType: string
  providerId: string | null
  slotStart: Date
  slotEnd: Date
  durationMinutes: number
  sourceAppointmentId?: string | null
}) {
  const source = (
    ['cancellation', 'no_show', 'reschedule', 'availability'].includes(params.source)
      ? params.source
      : 'availability'
  ) as OpenSlotSource

  const data: OpenSlotAvailableEventData = {
    openSlot: {
      id: params.openSlotEventId,
      source,
      triggerScenario: source,
      triggerLabel: OPEN_SLOT_SOURCE_LABELS[source],
      visitType: params.visitType,
      providerId: params.providerId,
      slotStart: params.slotStart.toISOString(),
      slotEnd: params.slotEnd.toISOString(),
      durationMinutes: params.durationMinutes,
      sourceAppointmentId: params.sourceAppointmentId ?? null,
    },
  }

  return emitEvent({
    practiceId: params.practiceId,
    eventName: 'crm/open_slot.available',
    entityType: 'open_slot',
    entityId: params.openSlotEventId,
    data,
  })
}
