/**
 * Live Open Dental appointment refresh for voice agents.
 *
 * Retell/MCP tools must answer from a fresh EHR pull — never CRM-only mirrors.
 */

import { prisma } from '@/lib/db'
import {
  buildAppointmentExternalId,
  isOpenDentalVoiceUpcomingStatus,
  openDentalNaiveToInstant,
  reconcileOpenDentalAppointmentsForPatient,
  type AppointmentSyncSummary,
} from '@/lib/integrations/opendental/appointmentSync'
import {
  formatAppointmentForVoice,
  type VoiceAppointment,
} from '@/lib/appointments/voice-context'

export type LiveOpenDentalRefreshResult = {
  attempted: boolean
  summary: AppointmentSyncSummary | null
  error: string | null
}

export type LiveUpcomingAppointmentsForVoiceResult = {
  appointments: VoiceAppointment[]
  summary: AppointmentSyncSummary | null
  error: string | null
  /** Why we returned empty without an OD error (e.g. not linked). */
  reason: string | null
  refreshedFromOpenDental: boolean
}

/**
 * Best-effort live pull of a patient's Open Dental appointments into CRM.
 * Self-gates when the patient/practice is not OD-linked; never throws.
 */
export async function refreshPatientAppointmentsFromOpenDentalForVoice(params: {
  practiceId: string
  patientId: string
}): Promise<LiveOpenDentalRefreshResult> {
  try {
    const result = await reconcileOpenDentalAppointmentsForPatient({
      practiceId: params.practiceId,
      patientId: params.patientId,
    })
    return {
      attempted: true,
      summary: result.summary,
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error('[voice] live Open Dental appointment refresh failed', {
      practiceId: params.practiceId,
      patientId: params.patientId,
      error: message,
    })
    return {
      attempted: true,
      summary: null,
      error: message,
    }
  }
}

/**
 * Live OD-sourced upcoming appointments for voice.
 * Builds the agent response from the OD list after upsert/prune — never from CRM-only rows.
 */
export async function getLiveUpcomingAppointmentsForVoice(params: {
  practiceId: string
  patientId: string
  limit?: number
}): Promise<LiveUpcomingAppointmentsForVoiceResult> {
  const limit = Math.min(Math.max(params.limit ?? 5, 1), 20)

  let reconciled: Awaited<ReturnType<typeof reconcileOpenDentalAppointmentsForPatient>>
  try {
    reconciled = await reconcileOpenDentalAppointmentsForPatient({
      practiceId: params.practiceId,
      patientId: params.patientId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error('[voice] live Open Dental upcoming pull failed', {
      practiceId: params.practiceId,
      patientId: params.patientId,
      error: message,
    })
    return {
      appointments: [],
      summary: null,
      error: message,
      reason: null,
      refreshedFromOpenDental: false,
    }
  }

  if (!reconciled.linked) {
    return {
      appointments: [],
      summary: reconciled.summary,
      error: null,
      reason: 'patient_not_linked_to_opendental',
      refreshedFromOpenDental: false,
    }
  }
  if (!reconciled.configured) {
    return {
      appointments: [],
      summary: reconciled.summary,
      error: null,
      reason: 'opendental_not_configured',
      refreshedFromOpenDental: false,
    }
  }

  const timeZone = reconciled.timeZone || 'America/Chicago'
  const now = Date.now()

  const upcomingOd = reconciled.liveOdAppointments
    .map((od) => {
      const start = openDentalNaiveToInstant(od.AptDateTime, timeZone)
      if (!start || start.getTime() < now) return null
      if (!isOpenDentalVoiceUpcomingStatus(od.AptStatus)) return null
      const aptNum = Number(od.AptNum)
      if (!Number.isInteger(aptNum) || aptNum <= 0) return null
      return { od, start, aptNum }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, limit)

  const appointments: VoiceAppointment[] = []
  for (const row of upcomingOd) {
    const calBookingId = buildAppointmentExternalId(row.aptNum)
    const crm = await prisma.appointment.findUnique({
      where: { calBookingId },
      select: {
        id: true,
        status: true,
        startTime: true,
        endTime: true,
        timezone: true,
        visitType: true,
        reason: true,
        notes: true,
        providerId: true,
      },
    })
    // Only speak appointments that exist in the live OD set AND were mirrored this pull.
    // Never fall back to an unrelated CRM scheduled row.
    if (!crm || crm.status === 'cancelled' || crm.status === 'completed') continue
    appointments.push(
      formatAppointmentForVoice({
        id: crm.id,
        status: crm.status,
        startTime: crm.startTime,
        endTime: crm.endTime,
        timezone: crm.timezone || timeZone,
        visitType: crm.visitType,
        reason: crm.reason,
        notes: crm.notes,
        providerId: crm.providerId,
      })
    )
  }

  return {
    appointments,
    summary: reconciled.summary,
    error: null,
    reason: null,
    refreshedFromOpenDental: true,
  }
}
