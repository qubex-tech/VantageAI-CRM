import { inngest } from '../client'
import {
  applyBrowserRunToEligibilityCheck,
  executeBrowserAgentRun,
} from '@/lib/browser-agent'
import { createDirectVoiceFallbackHandler } from '@/lib/eligibility/run-insurance-verification'
import { prisma } from '@/lib/db'

export const runBrowserAgent = inngest.createFunction(
  {
    id: 'run-browser-agent',
    name: 'Run Browser Agent Playbook',
    retries: 1,
    concurrency: [
      {
        // Cap concurrent portal sessions globally (must be <= Inngest plan limit)
        limit: 5,
      },
      {
        // Cap per practice to reduce portal ban risk
        key: 'event.data.practiceId',
        limit: 2,
      },
    ],
  },
  { event: 'browser-agent/run.requested' },
  async ({ event, step }) => {
    const { practiceId, runId } = event.data as {
      practiceId: string
      runId: string
      playbookId?: string
    }

    if (!practiceId || !runId) {
      return { error: 'Missing practiceId or runId' }
    }

    const result = await step.run('execute-playbook', async () => {
      return executeBrowserAgentRun(runId)
    })

    const applied = await step.run('apply-eligibility', async () => {
      return applyBrowserRunToEligibilityCheck(runId)
    })

    if (applied.handled && applied.escalateToVoice) {
      await step.run('voice-fallback', async () => {
        const run = await prisma.browserAgentRun.findUnique({
          where: { id: runId },
          select: { eligibilityCheckId: true },
        })
        if (!run?.eligibilityCheckId) return { skipped: true }

        const check = await prisma.eligibilityCheck.findUnique({
          where: { id: run.eligibilityCheckId },
          select: { patientId: true, policyId: true },
        })
        if (!check) return { skipped: true }

        const handler = await createDirectVoiceFallbackHandler({
          practiceId,
          userId: practiceId,
          patientId: check.patientId,
          policyId: check.policyId,
          source: 'api',
        })
        await handler(
          run.eligibilityCheckId,
          result.errorMessage || 'Availity portal RPA failed'
        )
        return { voiceFallback: true }
      })
    }

    return {
      runId,
      practiceId,
      ok: result.ok,
      applied,
    }
  }
)
