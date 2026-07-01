import { createOpenSlotEvent } from '@/lib/appointment-optimization/openSlotEvents'
import {
  getOutboundAgentsSettings,
  isAppointmentOptimizationEnabled,
  isTriggerScenarioEnabled,
} from '@/lib/appointment-optimization/settings'
import {
  SCENARIO_TO_SOURCE,
  type OpenSlotTriggerScenario,
} from '@/lib/appointment-optimization/types'

export type OpenSlotAppointmentInput = {
  id: string
  practiceId: string
  providerId: string | null
  visitType: string
  startTime: Date
  endTime: Date
  timezone: string
}

async function triggerOpenSlotForScenario(params: {
  practiceId: string
  providerId: string | null
  visitType: string
  slotStart: Date
  slotEnd: Date
  scenario: OpenSlotTriggerScenario
  sourceAppointmentId?: string | null
}) {
  if (params.slotStart <= new Date()) return null

  const settings = await getOutboundAgentsSettings(params.practiceId)
  if (!isAppointmentOptimizationEnabled(settings)) return null
  if (!isTriggerScenarioEnabled(settings, params.scenario)) {
    return { created: false as const, reason: 'scenario_disabled' }
  }

  try {
    return await createOpenSlotEvent({
      practiceId: params.practiceId,
      providerId: params.providerId,
      appointmentType: params.visitType,
      slotStart: params.slotStart,
      slotEnd: params.slotEnd,
      source: SCENARIO_TO_SOURCE[params.scenario],
      sourceAppointmentId: params.sourceAppointmentId ?? null,
    })
  } catch (error) {
    console.error('[AppointmentOptimization] failed to create open slot', {
      scenario: params.scenario,
      error,
    })
    return null
  }
}

export async function triggerOpenSlotFromCancelledAppointment(appointment: OpenSlotAppointmentInput & {
  status: string
}) {
  if (appointment.status !== 'cancelled') return null
  return triggerOpenSlotForScenario({
    practiceId: appointment.practiceId,
    providerId: appointment.providerId,
    visitType: appointment.visitType,
    slotStart: appointment.startTime,
    slotEnd: appointment.endTime,
    scenario: 'cancellation',
    sourceAppointmentId: appointment.id,
  })
}

export async function triggerOpenSlotFromNoShowAppointment(appointment: OpenSlotAppointmentInput & {
  status: string
}) {
  if (appointment.status !== 'no_show') return null
  return triggerOpenSlotForScenario({
    practiceId: appointment.practiceId,
    providerId: appointment.providerId,
    visitType: appointment.visitType,
    slotStart: appointment.startTime,
    slotEnd: appointment.endTime,
    scenario: 'noShow',
    sourceAppointmentId: appointment.id,
  })
}

/** When a reschedule frees the original visit time. */
export async function triggerOpenSlotFromRescheduledAppointment(params: {
  practiceId: string
  providerId: string | null
  visitType: string
  freedSlotStart: Date
  freedSlotEnd: Date
  sourceAppointmentId?: string | null
}) {
  return triggerOpenSlotForScenario({
    practiceId: params.practiceId,
    providerId: params.providerId,
    visitType: params.visitType,
    slotStart: params.freedSlotStart,
    slotEnd: params.freedSlotEnd,
    scenario: 'reschedule',
    sourceAppointmentId: params.sourceAppointmentId ?? null,
  })
}

/** When schedule sync or availability detection finds a blank opening. */
export async function triggerOpenSlotFromAvailability(params: {
  practiceId: string
  providerId: string | null
  visitType: string
  slotStart: Date
  slotEnd: Date
  sourceAppointmentId?: string | null
}) {
  return triggerOpenSlotForScenario({
    practiceId: params.practiceId,
    providerId: params.providerId,
    visitType: params.visitType,
    slotStart: params.slotStart,
    slotEnd: params.slotEnd,
    scenario: 'availability',
    sourceAppointmentId: params.sourceAppointmentId ?? null,
  })
}
