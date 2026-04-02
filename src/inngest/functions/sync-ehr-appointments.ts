import { inngest } from '../client'
import { syncEhrAppointmentsAcrossPractices } from '@/lib/integrations/ehr/scheduleSync'

const SCHEDULE_CRON = '0 * * * *'
const CHICAGO_TIMEZONE = 'America/Chicago'
const RUN_HOUR_CHICAGO = 5

function isScheduledChicagoHour(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0)
  return hour === RUN_HOUR_CHICAGO && minute === 0
}

export const syncEhrAppointmentsDaily = inngest.createFunction(
  {
    id: 'sync-ehr-appointments-daily',
    name: 'Sync EHR Appointments Daily',
  },
  { cron: SCHEDULE_CRON },
  async () => {
    if (!isScheduledChicagoHour()) {
      return { skipped: true, reason: 'outside_scheduled_hour' }
    }
    return syncEhrAppointmentsAcrossPractices()
  }
)
