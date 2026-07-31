import { prisma } from '@/lib/db'

/** Appointment statuses treated as an active future booking for automation conditions. */
export const FUTURE_SCHEDULED_APPOINTMENT_STATUS = 'scheduled' as const

export function buildFutureScheduledAppointmentWhere(
  practiceId: string,
  patientId: string,
  now: Date = new Date()
) {
  return {
    practiceId,
    patientId,
    status: FUTURE_SCHEDULED_APPOINTMENT_STATUS,
    startTime: { gt: now },
  }
}

/** True when the patient has at least one future appointment with status scheduled. */
export async function patientHasFutureScheduledAppointment(params: {
  practiceId: string
  patientId: string
  now?: Date
}): Promise<boolean> {
  const existing = await prisma.appointment.findFirst({
    where: buildFutureScheduledAppointmentWhere(
      params.practiceId,
      params.patientId,
      params.now ?? new Date()
    ),
    select: { id: true },
  })
  return Boolean(existing)
}
