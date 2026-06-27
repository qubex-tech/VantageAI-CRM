import { prisma } from '@/lib/db'
import { syncOpenDentalPatients, type PatientSyncSummary } from './patientSync'
import { syncOpenDentalAppointments, type AppointmentSyncSummary } from './appointmentSync'

const DAY_MS = 24 * 60 * 60 * 1000

/** Rolling appointment window defaults: recent past (call context) + near future (reminders). */
const DEFAULT_APPOINTMENT_DAYS_BEHIND = 7
const DEFAULT_APPOINTMENT_DAYS_AHEAD = 60
/** Overlap applied to the incremental patient watermark so edits near the boundary are not missed. */
const PATIENT_WATERMARK_OVERLAP_MS = DAY_MS

function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export type OpenDentalConnectionSyncResult = {
  practiceId: string
  status: 'success' | 'error'
  patients?: PatientSyncSummary
  appointments?: AppointmentSyncSummary
  error?: string
}

/**
 * Refresh patients and appointments for every active Open Dental connection.
 *
 * Patients sync incrementally from the connection's last successful sync watermark
 * (with a safety overlap); appointments sync over a rolling window. Designed to be
 * driven by a scheduled (cron) job.
 */
export async function syncAllOpenDentalConnections(options?: {
  appointmentDaysBehind?: number
  appointmentDaysAhead?: number
  fullPatients?: boolean
}): Promise<{ totalPractices: number; results: OpenDentalConnectionSyncResult[] }> {
  const connections = await prisma.openDentalConnection.findMany({
    where: { isActive: true },
    select: { practiceId: true, lastSuccessfulSyncAt: true },
  })

  const daysBehind = options?.appointmentDaysBehind ?? DEFAULT_APPOINTMENT_DAYS_BEHIND
  const daysAhead = options?.appointmentDaysAhead ?? DEFAULT_APPOINTMENT_DAYS_AHEAD

  const results: OpenDentalConnectionSyncResult[] = []

  for (const connection of connections) {
    const { practiceId } = connection
    try {
      const since =
        !options?.fullPatients && connection.lastSuccessfulSyncAt
          ? new Date(connection.lastSuccessfulSyncAt.getTime() - PATIENT_WATERMARK_OVERLAP_MS).toISOString()
          : undefined

      const patients = await syncOpenDentalPatients({ practiceId, since })

      const now = Date.now()
      const dateStart = formatYmd(new Date(now - daysBehind * DAY_MS))
      const dateEnd = formatYmd(new Date(now + daysAhead * DAY_MS))

      const appointments = await syncOpenDentalAppointments({ practiceId, dateStart, dateEnd })

      results.push({ practiceId, status: 'success', patients, appointments })
    } catch (error) {
      results.push({
        practiceId,
        status: 'error',
        error: error instanceof Error ? error.message : 'sync failed',
      })
    }
  }

  return { totalPractices: connections.length, results }
}
