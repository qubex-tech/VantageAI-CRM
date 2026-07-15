/**
 * Live Open Dental appointment refresh for voice agents.
 *
 * Retell/MCP tools must not rely on stale CRM mirrors during a live call —
 * pull the patient's OD appointments first, then read from CRM.
 */

import { syncOpenDentalAppointmentsForPatient } from '@/lib/integrations/opendental/appointmentSync'
import type { AppointmentSyncSummary } from '@/lib/integrations/opendental/appointmentSync'

export type LiveOpenDentalRefreshResult = {
  attempted: boolean
  summary: AppointmentSyncSummary | null
  error: string | null
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
    const summary = await syncOpenDentalAppointmentsForPatient({
      practiceId: params.practiceId,
      patientId: params.patientId,
    })
    return {
      attempted: true,
      summary,
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
