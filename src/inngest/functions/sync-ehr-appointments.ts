import { inngest } from '../client'
import { syncEhrAppointmentsAcrossPractices } from '@/lib/integrations/ehr/scheduleSync'

/** Daily at 5:00 AM America/Chicago (Inngest cron TZ). */
const SCHEDULE_CRON = '0 5 * * *'
const CHICAGO_TIMEZONE = 'America/Chicago'

export const syncEhrAppointmentsDaily = inngest.createFunction(
  {
    id: 'sync-ehr-appointments-daily',
    name: 'Sync EHR Appointments Daily',
  },
  { cron: SCHEDULE_CRON, tz: CHICAGO_TIMEZONE },
  async () => {
    const results = await syncEhrAppointmentsAcrossPractices()
    const zeroSyncPractices = results.results.filter(
      (entry) =>
        entry.status === 'success' &&
        typeof entry.details === 'object' &&
        entry.details !== null &&
        'synced' in entry.details &&
        (entry.details as { synced?: number }).synced === 0
    )
    return {
      ...results,
      zeroSyncPracticeCount: zeroSyncPractices.length,
      zeroSyncPracticeIds: zeroSyncPractices.map((entry) => entry.practiceId),
    }
  }
)
