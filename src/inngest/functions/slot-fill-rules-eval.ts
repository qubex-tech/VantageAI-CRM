import { inngest } from '../client'
import {
  listPracticesWithActiveSlotFillRules,
  runSlotFillRulesForPractice,
} from '@/lib/appointment-optimization/runSlotFillRules'

const SCHEDULE_CRON = '0 6 * * *'
const CHICAGO_TIMEZONE = 'America/Chicago'

/** Daily rules evaluation — processes pending open_slot_inventory only (no EHR calls). */
export const slotFillRulesEvalDaily = inngest.createFunction(
  {
    id: 'slot-fill-rules-eval-daily',
    name: 'Slot Fill Rules — Daily Evaluation',
  },
  { cron: SCHEDULE_CRON, tz: CHICAGO_TIMEZONE },
  async ({ step }) => {
    const practiceIds = await step.run('load-practices', async () => {
      return listPracticesWithActiveSlotFillRules()
    })

    const summaries = []
    for (const practiceId of practiceIds) {
      const summary = await step.run(`evaluate-${practiceId}`, async () => {
        return runSlotFillRulesForPractice(practiceId)
      })
      summaries.push(summary)
    }

    return {
      practices: practiceIds.length,
      summaries,
    }
  }
)
