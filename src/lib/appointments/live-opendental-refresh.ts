/**
 * Live Open Dental appointment refresh for voice agents.
 *
 * Retell/MCP tools must answer from a fresh EHR pull — never CRM-only mirrors.
 */

import { prisma } from '@/lib/db'
import {
  buildAppointmentExternalId,
  isOpenDentalVoicePreviousStatus,
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
  /** Most recent previous visits from the same live OD pull (newest first). */
  previousAppointments: VoiceAppointment[]
  summary: AppointmentSyncSummary | null
  error: string | null
  /** Why we returned empty without an OD error (e.g. not linked). */
  reason: string | null
  refreshedFromOpenDental: boolean
}

export type LivePreviousAppointmentsForVoiceResult = {
  appointments: VoiceAppointment[]
  summary: AppointmentSyncSummary | null
  error: string | null
  reason: string | null
  refreshedFromOpenDental: boolean
}

const VOICE_APPT_SELECT = {
  id: true,
  status: true,
  startTime: true,
  endTime: true,
  timezone: true,
  visitType: true,
  reason: true,
  notes: true,
  providerId: true,
} as const

type CrmVoiceAppointmentRow = {
  id: string
  status: string
  startTime: Date
  endTime: Date | null
  timezone: string | null
  visitType: string | null
  reason: string | null
  notes: string | null
  providerId: string | null
}

function formatCrmRowForVoice(crm: CrmVoiceAppointmentRow, timeZone: string): VoiceAppointment {
  return formatAppointmentForVoice({
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
}

function emptyLiveResult(partial: {
  error: string | null
  reason: string | null
  refreshedFromOpenDental: boolean
  summary: AppointmentSyncSummary | null
}): LiveUpcomingAppointmentsForVoiceResult {
  return {
    appointments: [],
    previousAppointments: [],
    ...partial,
  }
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
  previousLimit?: number
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
    return emptyLiveResult({
      summary: null,
      error: message,
      reason: null,
      refreshedFromOpenDental: false,
    })
  }

  if (!reconciled.linked) {
    return emptyLiveResult({
      summary: reconciled.summary,
      error: null,
      reason: 'patient_not_linked_to_opendental',
      refreshedFromOpenDental: false,
    })
  }
  if (!reconciled.configured) {
    return emptyLiveResult({
      summary: reconciled.summary,
      error: null,
      reason: 'opendental_not_configured',
      refreshedFromOpenDental: false,
    })
  }

  const timeZone = reconciled.timeZone || 'America/Chicago'
  const now = Date.now()
  const previousLimit = Math.min(Math.max(params.previousLimit ?? 5, 1), 20)

  const classified = reconciled.liveOdAppointments
    .map((od) => {
      const start = openDentalNaiveToInstant(od.AptDateTime, timeZone)
      const aptNum = Number(od.AptNum)
      if (!start || !Number.isInteger(aptNum) || aptNum <= 0) return null
      const upcoming =
        start.getTime() >= now && isOpenDentalVoiceUpcomingStatus(od.AptStatus)
      const previous = isOpenDentalVoicePreviousStatus(od.AptStatus, start, now)
      if (!upcoming && !previous) return null
      return { od, start, aptNum, upcoming, previous }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  const upcomingOd = classified
    .filter((row) => row.upcoming)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, limit)
  const previousOd = classified
    .filter((row) => row.previous)
    .sort((a, b) => b.start.getTime() - a.start.getTime())
    .slice(0, previousLimit)

  const appointments: VoiceAppointment[] = []
  for (const row of upcomingOd) {
    const crm = await prisma.appointment.findUnique({
      where: { calBookingId: buildAppointmentExternalId(row.aptNum) },
      select: VOICE_APPT_SELECT,
    })
    // Only speak appointments that exist in the live OD set AND were mirrored this pull.
    // Never fall back to an unrelated CRM scheduled row.
    if (!crm || crm.status === 'cancelled' || crm.status === 'completed') continue
    appointments.push(formatCrmRowForVoice(crm, timeZone))
  }

  const previousAppointments: VoiceAppointment[] = []
  for (const row of previousOd) {
    const crm = await prisma.appointment.findUnique({
      where: { calBookingId: buildAppointmentExternalId(row.aptNum) },
      select: VOICE_APPT_SELECT,
    })
    if (!crm || crm.status === 'cancelled') continue
    previousAppointments.push(formatCrmRowForVoice(crm, timeZone))
  }

  return {
    appointments,
    previousAppointments,
    summary: reconciled.summary,
    error: null,
    reason: null,
    refreshedFromOpenDental: true,
  }
}

/**
 * Live OD-sourced previous / last visits for voice.
 * Same EHR pull as upcoming; filters Complete and past Scheduled/ASAP.
 */
export async function getLivePreviousAppointmentsForVoice(params: {
  practiceId: string
  patientId: string
  limit?: number
}): Promise<LivePreviousAppointmentsForVoiceResult> {
  const live = await getLiveUpcomingAppointmentsForVoice({
    practiceId: params.practiceId,
    patientId: params.patientId,
    previousLimit: params.limit ?? 5,
  })
  return {
    appointments: live.previousAppointments,
    summary: live.summary,
    error: live.error,
    reason: live.reason,
    refreshedFromOpenDental: live.refreshedFromOpenDental,
  }
}
