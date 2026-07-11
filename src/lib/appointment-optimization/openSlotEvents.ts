import { prisma } from '@/lib/db'
import { inngest } from '@/inngest/client'
import { emitOpenSlotAvailableEvent } from '@/lib/appointment-optimization/emitOpenSlotAvailable'
import {
  getOutboundAgentsSettings,
  isAppointmentOptimizationEnabled,
  usesAutomationSlotFillOutreach,
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

async function slotAlreadyOccupied(input: CreateOpenSlotInput): Promise<boolean> {
  const overlapping = await prisma.appointment.findFirst({
    where: {
      practiceId: input.practiceId,
      status: { in: ['scheduled', 'confirmed'] },
      ...(input.providerId ? { providerId: input.providerId } : {}),
      startTime: { lt: input.slotEnd },
      endTime: { gt: input.slotStart },
    },
    select: { id: true },
  })
  return Boolean(overlapping)
}

async function publishOpenSlotCreated(
  payload: OpenSlotCreatedPayload,
  eventId: string,
  mode: 'create' | 'reopen'
) {
  await inngest.send({
    name: 'crm/open-slot.created',
    data: payload,
    id:
      mode === 'reopen'
        ? `open-slot-reopen-${eventId}-${Date.now()}`
        : `open-slot-${eventId}`,
  })
}

async function publishSlotAvailable(params: {
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
  try {
    await emitOpenSlotAvailableEvent(params)
  } catch (error) {
    console.error('[AppointmentOptimization] failed to emit open_slot.available', {
      openSlotEventId: params.openSlotEventId,
      error: error instanceof Error ? error.message : error,
    })
  }
}

export async function createOpenSlotEvent(input: CreateOpenSlotInput) {
  const settings = await getOutboundAgentsSettings(input.practiceId)
  if (!isAppointmentOptimizationEnabled(settings)) {
    return { created: false as const, reason: 'agent_disabled' }
  }

  if (input.slotStart <= new Date()) {
    return { created: false as const, reason: 'slot_in_past' }
  }

  if (await slotAlreadyOccupied(input)) {
    return { created: false as const, reason: 'already_occupied' }
  }

  const durationMinutes = Math.max(
    1,
    Math.round((input.slotEnd.getTime() - input.slotStart.getTime()) / (60 * 1000))
  )
  const idempotencyKey = buildIdempotencyKey(input)
  const automationMode = usesAutomationSlotFillOutreach(settings)

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

      await publishSlotAvailable({
        practiceId: existing.practiceId,
        openSlotEventId: existing.id,
        source: existing.source,
        visitType: existing.appointmentType,
        providerId: existing.providerId,
        slotStart: existing.slotStart,
        slotEnd: existing.slotEnd,
        durationMinutes: existing.durationMinutes,
        sourceAppointmentId: input.sourceAppointmentId ?? existing.sourceAppointmentId,
      })

      if (!automationMode) {
        await publishOpenSlotCreated(payload, existing.id, 'reopen')
      }

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

  await publishSlotAvailable({
    practiceId: event.practiceId,
    openSlotEventId: event.id,
    source: event.source,
    visitType: event.appointmentType,
    providerId: event.providerId,
    slotStart: event.slotStart,
    slotEnd: event.slotEnd,
    durationMinutes: event.durationMinutes,
    sourceAppointmentId: event.sourceAppointmentId,
  })

  if (!automationMode) {
    await publishOpenSlotCreated(payload, event.id, 'create')
  }

  return { created: true as const, openSlotEventId: event.id, event }
}
