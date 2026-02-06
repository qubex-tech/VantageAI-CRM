import { inngest } from '../client'
import { getRetellClient } from '@/lib/retell-api'
import { processRetellCallData } from '@/lib/process-call-data'

/**
 * Real-time RetellAI call processing (no CRM login required)
 *
 * Triggered when a call ends via webhook. Fetches full call data from RetellAPI
 * (including post-call analysis), extracts patient info, and creates/updates
 * patient records and voice conversation records.
 *
 * Includes a 30s delay to allow RetellAI post-call analysis to complete.
 */
export const processRetellCallEnded = inngest.createFunction(
  {
    id: 'process-retell-call-ended',
    name: 'Process RetellAI Call Ended',
    retries: 3,
  },
  { event: 'retell/call.ended' },
  async ({ event, step }) => {
    const { practiceId, callId } = event.data as { practiceId: string; callId: string }

    if (!practiceId || !callId) {
      console.error('[processRetellCallEnded] Missing practiceId or callId', event.data)
      return { error: 'Missing practiceId or callId' }
    }

    // Wait for RetellAI post-call analysis to complete (typically 15-30 seconds)
    await step.sleep('wait-for-analysis', 30_000)

    const fullCall = await step.run('fetch-call', async () => {
      const retellClient = await getRetellClient(practiceId)
      return retellClient.getCall(callId)
    })

    if (!fullCall) {
      console.error('[processRetellCallEnded] Failed to fetch call', callId)
      return { error: 'Failed to fetch call' }
    }

    await step.run('process-call-data', async () => {
      await processRetellCallData(practiceId, fullCall, null)
    })

    return { callId, practiceId }
  }
)
