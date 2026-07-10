import { prisma } from '@/lib/db'
import { WAVE_BATCH_SIZE } from '@/lib/appointment-optimization/types'

export type SlotFillCandidate = {
  patientId: string
  appointmentId: string
  appointmentStart: Date
  patientName: string
  phone: string | null
}

/**
 * Patients with a later appointment (same provider + visit type) who opted into earlier notifications.
 * Ranked by farthest appointment date first.
 */
export async function findEligibleCandidates(params: {
  practiceId: string
  providerId: string | null
  appointmentType: string
  slotStart: Date
  slotEnd: Date
  durationMinutes: number
  openSlotEventId: string
  waveNumber: number
  limit?: number
  /** Inclusive: first appointment time eligible for outreach. */
  lookAheadStart?: Date
  /** Inclusive: last appointment time eligible for outreach. */
  lookAheadEnd?: Date
  slotFillRuleId?: string
}): Promise<SlotFillCandidate[]> {
  const limit = params.limit ?? WAVE_BATCH_SIZE
  const slotDurationMs = params.durationMinutes * 60 * 1000
  const slotLengthMs = params.slotEnd.getTime() - params.slotStart.getTime()
  if (slotLengthMs < slotDurationMs * 0.9) {
    return []
  }

  const alreadyContacted = await prisma.outreachAttempt.findMany({
    where: { openSlotEventId: params.openSlotEventId },
    select: { patientId: true },
  })
  const excludedPatientIds = new Set(alreadyContacted.map((row: { patientId: string }) => row.patientId))

  const appointments = await prisma.appointment.findMany({
    where: {
      practiceId: params.practiceId,
      status: { in: ['scheduled', 'confirmed'] },
      visitType: params.appointmentType,
      startTime: {
        ...(params.lookAheadStart
          ? { gte: params.lookAheadStart }
          : { gt: params.slotStart }),
        ...(params.lookAheadEnd ? { lte: params.lookAheadEnd } : {}),
      },
      ...(params.providerId ? { providerId: params.providerId } : {}),
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          firstName: true,
          preferredName: true,
          phone: true,
          primaryPhone: true,
          secondaryPhone: true,
          doNotContact: true,
          smsOptIn: true,
          communicationPreferences: {
            select: {
              smsEnabled: true,
              earlierAppointmentOptIn: true,
            },
          },
        },
      },
    },
    orderBy: { startTime: 'desc' },
    take: 200,
  })

  const candidates: SlotFillCandidate[] = []

  for (const apt of appointments) {
    if (excludedPatientIds.has(apt.patientId)) continue
    const patient = apt.patient
    if (patient.doNotContact) continue

    const prefs = patient.communicationPreferences?.[0]
    const earlierOptIn = prefs?.earlierAppointmentOptIn ?? true
    const smsOk = (prefs?.smsEnabled ?? true) && (patient.smsOptIn || true)
    if (!earlierOptIn || !smsOk) continue

    const aptDurationMs = apt.endTime.getTime() - apt.startTime.getTime()
    if (Math.abs(aptDurationMs - slotDurationMs) > 15 * 60 * 1000) continue

    const phone = (patient.primaryPhone || patient.phone || patient.secondaryPhone || '').trim()
    if (!phone) continue

    candidates.push({
      patientId: patient.id,
      appointmentId: apt.id,
      appointmentStart: apt.startTime,
      patientName: patient.preferredName || patient.firstName || patient.name,
      phone,
    })
    excludedPatientIds.add(patient.id)
  }

  return candidates.slice(0, limit)
}
