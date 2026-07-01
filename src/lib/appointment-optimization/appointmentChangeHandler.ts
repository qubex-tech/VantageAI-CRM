import {
  triggerOpenSlotFromCancelledAppointment,
  triggerOpenSlotFromNoShowAppointment,
  triggerOpenSlotFromRescheduledAppointment,
  type OpenSlotAppointmentInput,
} from '@/lib/appointment-optimization/trigger'

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
      await triggerOpenSlotFromCancelledAppointment(after)
    }

    if (after.status === 'no_show' && before?.status !== 'no_show') {
      await triggerOpenSlotFromNoShowAppointment(after)
    }

    if (before) {
      const timeChanged =
        before.startTime.getTime() !== after.startTime.getTime() ||
        before.endTime.getTime() !== after.endTime.getTime()
      if (timeChanged && before.startTime > new Date()) {
        await triggerOpenSlotFromRescheduledAppointment({
          practiceId: before.practiceId,
          providerId: before.providerId,
          visitType: before.visitType,
          freedSlotStart: before.startTime,
          freedSlotEnd: before.endTime,
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
