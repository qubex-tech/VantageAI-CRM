import { inngest } from '../client'
import { pollAndFinalizeEligibilityCheck } from '@/lib/eligibility/run-eligibility-check'
import { createVoiceFallbackHandler } from '@/lib/eligibility/run-insurance-verification'

const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 25

export const pollAvailityCoverage = inngest.createFunction(
  {
    id: 'poll-availity-coverage',
    name: 'Poll Availity Coverage Eligibility',
    retries: 2,
  },
  { event: 'availity/coverage.submitted' },
  async ({ event, step }) => {
    const { practiceId, userId, eligibilityCheckId, coverageId } = event.data as {
      practiceId: string
      userId?: string
      eligibilityCheckId: string
      coverageId: string
    }

    if (!practiceId || !eligibilityCheckId || !coverageId) {
      return { error: 'Missing required event fields' }
    }

    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      if (attempt > 0) {
        await step.sleep(`poll-wait-${attempt}`, POLL_INTERVAL_MS)
      }

      const pollResult = await step.run(`poll-coverage-${attempt}`, async () => {
        const check = await import('@/lib/db').then((m) =>
          m.prisma.eligibilityCheck.findUnique({
            where: { id: eligibilityCheckId },
            select: { patientId: true, policyId: true },
          })
        )
        if (!check) return { done: true as const, error: 'check_not_found' }

        const handler = await createVoiceFallbackHandler({
          practiceId,
          userId: userId || practiceId,
          patientId: check.patientId,
          policyId: check.policyId,
          source: 'api',
        })

        return pollAndFinalizeEligibilityCheck({
          practiceId,
          eligibilityCheckId,
          coverageId,
          userId,
          triggerVoiceFallback: handler,
        })
      })

      if ('error' in pollResult && pollResult.error) {
        return pollResult
      }

      if (pollResult.done && 'result' in pollResult) {
        return {
          eligibilityCheckId,
          coverageId,
          status: pollResult.result?.status,
        }
      }
    }

    await step.run('mark-timeout-fallback', async () => {
      const check = await import('@/lib/db').then((m) =>
        m.prisma.eligibilityCheck.findUnique({
          where: { id: eligibilityCheckId },
          select: { patientId: true, policyId: true },
        })
      )
      if (!check) return

      const handler = await createVoiceFallbackHandler({
        practiceId,
        userId: userId || practiceId,
        patientId: check.patientId,
        policyId: check.policyId,
        source: 'api',
      })
      await handler(eligibilityCheckId, 'Availity eligibility polling timed out')
    })

    return {
      eligibilityCheckId,
      coverageId,
      status: 'fallback_voice',
      reason: 'timeout',
    }
  }
)
