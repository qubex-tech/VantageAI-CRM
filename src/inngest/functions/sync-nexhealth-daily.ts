import { inngest } from '../client'
import { syncAllNexhealthConnections } from '@/lib/integrations/nexhealth/scheduledSync'

/** Daily at 4:45 AM America/Chicago, after the Open Dental sync. */
const SCHEDULE_CRON = '45 4 * * *'
const CHICAGO_TIMEZONE = 'America/Chicago'

export const syncNexhealthDaily = inngest.createFunction(
  {
    id: 'sync-nexhealth-daily',
    name: 'Sync NexHealth Patients & Appointments Daily',
  },
  { cron: SCHEDULE_CRON, tz: CHICAGO_TIMEZONE },
  async ({ step }) => {
    const result = await step.run('sync-nexhealth-connections', () => syncAllNexhealthConnections())
    const errorPractices = result.results.filter((entry) => entry.status === 'error')
    return {
      totalPractices: result.totalPractices,
      successCount: result.results.length - errorPractices.length,
      errorCount: errorPractices.length,
      errorPracticeIds: errorPractices.map((entry) => entry.practiceId),
    }
  }
)
