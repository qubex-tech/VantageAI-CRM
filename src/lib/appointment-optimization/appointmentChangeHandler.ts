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
 * EHR-agnostic entry point: compare appointment state before/after any write
 * (CRM UI, Cal.com, ECW sync, Open Dental sync, portal, etc.) and fire
 * configured Slot Fill trigger scenarios.
 */
export async function handleAppointmentChangeForSlotFill(params: {
  before: AppointmentSlotFillSnapshot | null
  after: AppointmentSlotFillSnapshot
}) {
  const { before, after } = params

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
