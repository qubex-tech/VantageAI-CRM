import type { OpenSlotSource, OpenTimeSlot } from '@/lib/appointment-optimization/types'

export function buildOpenTimeSlotFromAppointment(
  appointment: {
    id: string
    practiceId: string
    providerId: string | null
    visitType: string
    startTime: Date
    endTime: Date
  },
  params: {
    openSlotSource: OpenSlotSource
    sourceAppointmentId?: string | null
    slotStart?: Date
    slotEnd?: Date
  }
): OpenTimeSlot {
  return {
    practiceId: appointment.practiceId,
    providerId: appointment.providerId,
    visitType: appointment.visitType,
    start: params.slotStart ?? appointment.startTime,
    end: params.slotEnd ?? appointment.endTime,
    openSlotSource: params.openSlotSource,
    sourceAppointmentId: params.sourceAppointmentId ?? appointment.id,
    origin: { system: 'crm', externalId: appointment.id },
  }
}

export function parseOpenSlotEventMetadata(metadata: unknown): {
  lookAheadEnd?: Date
  slotFillRuleId?: string
} {
  if (!metadata || typeof metadata !== 'object') return {}
  const raw = metadata as Record<string, unknown>
  const lookAheadEnd =
    typeof raw.lookAheadEnd === 'string' ? new Date(raw.lookAheadEnd) : undefined
  const slotFillRuleId =
    typeof raw.slotFillRuleId === 'string' ? raw.slotFillRuleId : undefined
  if (lookAheadEnd && Number.isNaN(lookAheadEnd.getTime())) {
    return { slotFillRuleId }
  }
  return { lookAheadEnd, slotFillRuleId }
}
