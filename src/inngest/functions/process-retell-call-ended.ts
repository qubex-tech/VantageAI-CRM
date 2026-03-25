import { inngest } from '../client'
import { getRetellClient } from '@/lib/retell-api'
import { processRetellCallData } from '@/lib/process-call-data'
import { writeBackRetellCallToEhr } from '@/lib/integrations/ehr/writeback'
import type { RetellCall } from '@/lib/retell-api'

/**
 * Real-time RetellAI call processing (no CRM login required)
 *
 * Triggered by call_ended or call_analyzed webhook. Per RetellAI docs:
 * - call_analyzed: full call data including call_analysis - use directly, no fetch
 * - call_ended: excludes call_analysis - fetch via API after 30s delay
 */
const RETELL_PROCESS_VERSION = 'retell_extraction_v4'

export const processRetellCallEnded = inngest.createFunction(
  {
    id: 'process-retell-call-ended-v2',
    name: 'Process RetellAI Call Ended v2',
    retries: 3,
  },
  { event: 'retell/call.ended' },
  async ({ event, step }) => {
    console.info('[processRetellCallEnded] Version', RETELL_PROCESS_VERSION)
    const { practiceId, callId, eventType, call: webhookCall } = event.data as {
      practiceId: string
      callId: string
      eventType?: string
      call?: RetellCall
    }

    if (!practiceId || !callId) {
      console.error('[processRetellCallEnded] Missing practiceId or callId', event.data)
      return { error: 'Missing practiceId or callId' }
    }

    let fullCall: RetellCall | null

    if (webhookCall && eventType === 'call_analyzed') {
      const hasAnalysis = Boolean((webhookCall as RetellCall).call_analysis)
      if (hasAnalysis) {
        fullCall = webhookCall as RetellCall
      } else {
        fullCall = null
      }
    } else {
      fullCall = null
    }

    if (!fullCall) {
      await step.sleep('wait-for-analysis', 30_000)
      fullCall = await step.run('fetch-call', async () => {
        const retellClient = await getRetellClient(practiceId)
        return retellClient.getCall(callId)
      })
    }

    if (!fullCall) {
      console.error('[processRetellCallEnded] Failed to get call', callId)
      return { error: 'Failed to get call' }
    }

    const { patientId, extractedData } = await step.run('process-call-data', async () => {
      return processRetellCallData(practiceId, fullCall, null)
    })

    await step.run('ehr-writeback', async () => {
      await writeBackRetellCallToEhr({
        practiceId,
        patientId,
        call: fullCall,
        extractedData,
      })
    })

    return { callId, practiceId }
  }
)
