import { createOpenSlotFromCancelledAppointment } from '@/lib/appointment-optimization/openSlotEvents'

export async function triggerOpenSlotFromCancelledAppointment(appointment: {
  id: string
  practiceId: string
  providerId: string | null
  visitType: string
  startTime: Date
  endTime: Date
  timezone: string
  status: string
}) {
  if (appointment.status !== 'cancelled') return null
  if (appointment.startTime <= new Date()) return null
  try {
    return await createOpenSlotFromCancelledAppointment(appointment)
  } catch (error) {
    console.error('[AppointmentOptimization] failed to create open slot', error)
    return null
  }
}
