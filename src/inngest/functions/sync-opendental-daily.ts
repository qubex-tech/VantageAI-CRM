import { inngest } from '../client'
import { syncAllOpenDentalConnections } from '@/lib/integrations/opendental/scheduledSync'

/** Daily at 4:30 AM America/Chicago (Inngest cron TZ). */
const SCHEDULE_CRON = '30 4 * * *'
const CHICAGO_TIMEZONE = 'America/Chicago'

export const syncOpenDentalDaily = inngest.createFunction(
  {
    id: 'sync-opendental-daily',
    name: 'Sync Open Dental Patients & Appointments Daily',
  },
  { cron: SCHEDULE_CRON, tz: CHICAGO_TIMEZONE },
  async ({ step }) => {
    const result = await step.run('sync-open-dental-connections', () =>
      syncAllOpenDentalConnections()
    )

    const errorPractices = result.results.filter((entry) => entry.status === 'error')
    return {
      totalPractices: result.totalPractices,
      successCount: result.results.length - errorPractices.length,
      errorCount: errorPractices.length,
      errorPracticeIds: errorPractices.map((entry) => entry.practiceId),
    }
  }
)
