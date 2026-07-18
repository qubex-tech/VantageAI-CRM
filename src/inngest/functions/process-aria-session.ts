import { inngest } from '@/inngest/client'
import { runAriaSessionPipeline } from '@/lib/aria/process'

export const processAriaSession = inngest.createFunction(
  {
    id: 'process-aria-session',
    name: 'Process Aria Scribe Session',
    retries: 2,
    concurrency: { limit: 4, key: 'event.data.practiceId' },
  },
  { event: 'aria/session.process' },
  async ({ event, step }) => {
    const { sessionId, practiceId } = event.data as {
      sessionId: string
      practiceId: string
    }

    return step.run('run-pipeline', async () =>
      runAriaSessionPipeline({ sessionId, practiceId, notify: true })
    )
  }
)
