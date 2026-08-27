import { prisma } from '@/lib/db'
import { emitEvent } from '@/lib/outbox'
import {
  getOutboundAgentsSettings,
  hasActiveSlotFillRules,
  isAppointmentOptimizationEnabled,
  isTriggerScenarioEnabled,
} from '@/lib/appointment-optimization/settings'
import { ingestAndEvaluateOpenTimeSlot } from '@/lib/appointment-optimization/runSlotFillRules'
import { buildOpenTimeSlotFromAppointment } from '@/lib/appointment-optimization/slotFillUtils'
import {
  triggerOpenSlotFromCancelledAppointment,
  triggerOpenSlotFromNoShowAppointment,
  triggerOpenSlotFromRescheduledAppointment,
  type OpenSlotAppointmentInput,
} from '@/lib/appointment-optimization/trigger'
import type { OpenSlotTriggerScenario } from '@/lib/appointment-optimization/types'

export type AppointmentSlotFillSnapshot = OpenSlotAppointmentInput & {
  status: string
}

const SLOT_FILL_SELECT = {
  id: true,
  practiceId: true,
  providerId: true,
  visitType: true,
  startTime: true,
  endTime: true,
  timezone: true,
  status: true,
} as const

export function toAppointmentSlotFillSnapshot(
  appointment: AppointmentSlotFillSnapshot
): AppointmentSlotFillSnapshot {
  return {
    id: appointment.id,
    practiceId: appointment.practiceId,
    providerId: appointment.providerId,
    visitType: appointment.visitType,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    timezone: appointment.timezone,
    status: appointment.status,
  }
}

export { SLOT_FILL_SELECT }

async function handleFreedSlot(params: {
  appointment: AppointmentSlotFillSnapshot
  scenario: OpenSlotTriggerScenario
  slotStart: Date
  slotEnd: Date
  sourceAppointmentId?: string
}) {
  const settings = await getOutboundAgentsSettings(params.appointment.practiceId)
  if (!isAppointmentOptimizationEnabled(settings)) return
  if (!isTriggerScenarioEnabled(settings, params.scenario)) return

  if (hasActiveSlotFillRules(settings)) {
    const slot = buildOpenTimeSlotFromAppointment(params.appointment, {
      openSlotSource:
        params.scenario === 'cancellation'
          ? 'cancellation'
          : params.scenario === 'noShow'
            ? 'no_show'
            : params.scenario === 'reschedule'
              ? 'reschedule'
              : 'availability',
      sourceAppointmentId: params.sourceAppointmentId ?? params.appointment.id,
      slotStart: params.slotStart,
      slotEnd: params.slotEnd,
    })
    await ingestAndEvaluateOpenTimeSlot(slot)
    return
  }

  if (params.scenario === 'cancellation') {
    await triggerOpenSlotFromCancelledAppointment({
      ...params.appointment,
      startTime: params.slotStart,
      endTime: params.slotEnd,
      status: 'cancelled',
    })
    return
  }
  if (params.scenario === 'noShow') {
    await triggerOpenSlotFromNoShowAppointment({
      ...params.appointment,
      startTime: params.slotStart,
      endTime: params.slotEnd,
      status: 'no_show',
    })
    return
  }
  if (params.scenario === 'reschedule') {
    await triggerOpenSlotFromRescheduledAppointment({
      practiceId: params.appointment.practiceId,
      providerId: params.appointment.providerId,
      visitType: params.appointment.visitType,
      freedSlotStart: params.slotStart,
      freedSlotEnd: params.slotEnd,
      sourceAppointmentId: params.sourceAppointmentId ?? params.appointment.id,
    })
  }
}

/**
 * True when appointment status became cancelled (CRM cancel or eCW Encounter cancelled).
 * Newly synced cancelled visits only emit if they are still upcoming.
 */
export function shouldEmitAppointmentCancelledEvent(
  before: { status: string } | null,
  after: { status: string; startTime: Date },
  now: Date = new Date()
): boolean {
  if (after.status !== 'cancelled') return false
  if (before?.status === 'cancelled') return false
  if (before) return true
  return after.startTime.getTime() > now.getTime()
}

async function emitAppointmentCancelledAutomation(appointment: AppointmentSlotFillSnapshot) {
  const row = await prisma.appointment.findFirst({
    where: { id: appointment.id, practiceId: appointment.practiceId },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          phone: true,
          primaryPhone: true,
          secondaryPhone: true,
          email: true,
        },
      },
    },
  })
  if (!row?.patient) return

  await emitEvent({
    practiceId: appointment.practiceId,
    eventName: 'crm/appointment.cancelled',
    entityType: 'appointment',
    entityId: row.id,
    data: {
      appointment: {
        id: row.id,
        patientId: row.patientId,
        status: row.status,
        startTime: row.startTime.toISOString(),
        endTime: row.endTime.toISOString(),
        visitType: row.visitType,
      },
      patient: row.patient,
    },
  })
}

/**
 * EHR-agnostic entry point: compare appointment state before/after any write
 * (CRM UI, Cal.com, ECW sync, Open Dental sync, portal, etc.) and fire
 * configured Slot Fill trigger scenarios.
 */
export async function handleAppointmentChangeForSlotFill(params: {
  before: AppointmentSlotFillSnapshot | null
  after: AppointmentSlotFillSnapshot
}) {
  const { before, after } = params

  if (shouldEmitAppointmentCancelledEvent(before, after)) {
    try {
      await emitAppointmentCancelledAutomation(after)
    } catch (error) {
      console.error('[automation] appointment cancelled emit failed', {
        appointmentId: after.id,
        error: error instanceof Error ? error.message : error,
      })
    }
  }

  try {
    if (after.status === 'cancelled' && before?.status !== 'cancelled') {
      await handleFreedSlot({
        appointment: after,
        scenario: 'cancellation',
        slotStart: after.startTime,
        slotEnd: after.endTime,
      })
    }

    if (after.status === 'no_show' && before?.status !== 'no_show') {
      await handleFreedSlot({
        appointment: after,
        scenario: 'noShow',
        slotStart: after.startTime,
        slotEnd: after.endTime,
      })
    }

    if (before) {
      const timeChanged =
        before.startTime.getTime() !== after.startTime.getTime() ||
        before.endTime.getTime() !== after.endTime.getTime()
      if (timeChanged && before.startTime > new Date()) {
        await handleFreedSlot({
          appointment: before,
          scenario: 'reschedule',
          slotStart: before.startTime,
          slotEnd: before.endTime,
          sourceAppointmentId: after.id,
        })
      }
    }
  } catch (error) {
    console.error('[SlotFill] appointment change handler failed', {
      appointmentId: after.id,
      error: error instanceof Error ? error.message : error,
    })
  }
}
