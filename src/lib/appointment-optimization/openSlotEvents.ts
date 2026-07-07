import { prisma } from '@/lib/db'
import { inngest } from '@/inngest/client'
import {
  getOutboundAgentsSettings,
  isAppointmentOptimizationEnabled,
} from '@/lib/appointment-optimization/settings'
import type { OpenSlotCreatedPayload, OpenSlotEventMetadata } from '@/lib/appointment-optimization/types'
import { OPEN_SLOT_STATUS } from '@/lib/appointment-optimization/types'
import { isOpenSlotFilled } from '@/lib/appointment-optimization/slotFilled'

import type { OpenSlotSource } from '@/lib/appointment-optimization/types'

export type CreateOpenSlotInput = {
  practiceId: string
  providerId: string | null
  appointmentType: string
  slotStart: Date
  slotEnd: Date
  locationId?: string | null
  source: OpenSlotSource
  sourceAppointmentId?: string | null
  metadata?: OpenSlotEventMetadata
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
    const canReopen =
      (existing.status === OPEN_SLOT_STATUS.FILLED ||
        existing.status === OPEN_SLOT_STATUS.EXHAUSTED) &&
      !(await isOpenSlotFilled(existing.id))

    if (canReopen) {
      await prisma.openSlotEvent.update({
        where: { id: existing.id },
        data: {
          status: OPEN_SLOT_STATUS.OPEN,
          filledAt: null,
          sourceAppointmentId: input.sourceAppointmentId ?? existing.sourceAppointmentId,
          metadata: input.metadata ?? existing.metadata ?? undefined,
        },
      })

      const payload: OpenSlotCreatedPayload = {
        openSlotEventId: existing.id,
        practiceId: existing.practiceId,
        providerId: existing.providerId,
        appointmentType: existing.appointmentType,
        slotStart: existing.slotStart.toISOString(),
        slotEnd: existing.slotEnd.toISOString(),
        durationMinutes: existing.durationMinutes,
      }

      await inngest.send({
        name: 'crm/open-slot.created',
        data: payload,
        id: `open-slot-reopen-${existing.id}-${Date.now()}`,
      })

      return { created: true as const, openSlotEventId: existing.id, reopened: true as const }
    }

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
      metadata: input.metadata ?? undefined,
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
