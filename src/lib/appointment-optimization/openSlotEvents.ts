import { prisma } from '@/lib/db'
import { inngest } from '@/inngest/client'
import {
  getOutboundAgentsSettings,
  isAppointmentOptimizationEnabled,
} from '@/lib/appointment-optimization/settings'
import type { OpenSlotCreatedPayload } from '@/lib/appointment-optimization/types'

export type CreateOpenSlotInput = {
  practiceId: string
  providerId: string | null
  appointmentType: string
  slotStart: Date
  slotEnd: Date
  locationId?: string | null
  source: 'cancellation' | 'reschedule' | 'availability'
  sourceAppointmentId?: string | null
}

function buildIdempotencyKey(input: CreateOpenSlotInput) {
  const start = input.slotStart.toISOString()
  const provider = input.providerId || 'any'
  return `${provider}:${start}:${input.appointmentType}:${input.source}`
}

export async function createOpenSlotEvent(input: CreateOpenSlotInput) {
  const settings = await getOutboundAgentsSettings(input.practiceId)
  if (!isAppointmentOptimizationEnabled(settings)) {
    return { created: false as const, reason: 'agent_disabled' }
  }

  if (input.slotStart <= new Date()) {
    return { created: false as const, reason: 'slot_in_past' }
  }

  const durationMinutes = Math.max(
    1,
    Math.round((input.slotEnd.getTime() - input.slotStart.getTime()) / (60 * 1000))
  )
  const idempotencyKey = buildIdempotencyKey(input)

  const existing = await prisma.openSlotEvent.findUnique({
    where: {
      practiceId_idempotencyKey: {
        practiceId: input.practiceId,
        idempotencyKey,
      },
    },
  })
  if (existing) {
    return { created: false as const, reason: 'duplicate', openSlotEventId: existing.id }
  }

  const event = await prisma.openSlotEvent.create({
    data: {
      practiceId: input.practiceId,
      providerId: input.providerId,
      appointmentType: input.appointmentType,
      slotStart: input.slotStart,
      slotEnd: input.slotEnd,
      durationMinutes,
      locationId: input.locationId ?? null,
      source: input.source,
      sourceAppointmentId: input.sourceAppointmentId ?? null,
      idempotencyKey,
      status: 'open',
    },
  })

  const payload: OpenSlotCreatedPayload = {
    openSlotEventId: event.id,
    practiceId: event.practiceId,
    providerId: event.providerId,
    appointmentType: event.appointmentType,
    slotStart: event.slotStart.toISOString(),
    slotEnd: event.slotEnd.toISOString(),
    durationMinutes: event.durationMinutes,
  }

  await inngest.send({
    name: 'crm/open-slot.created',
    data: payload,
    id: `open-slot-${event.id}`,
  })

  return { created: true as const, openSlotEventId: event.id, event }
}

export async function createOpenSlotFromCancelledAppointment(appointment: {
  id: string
  practiceId: string
  providerId: string | null
  visitType: string
  startTime: Date
  endTime: Date
  timezone: string
}) {
  return createOpenSlotEvent({
    practiceId: appointment.practiceId,
    providerId: appointment.providerId,
    appointmentType: appointment.visitType,
    slotStart: appointment.startTime,
    slotEnd: appointment.endTime,
    source: 'cancellation',
    sourceAppointmentId: appointment.id,
  })
}
