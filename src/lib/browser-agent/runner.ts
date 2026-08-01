import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { inngest } from '@/inngest/client'
import { getBrowserCredential } from './credentials'
import { getPlaybook } from './playbooks'
import { createBrowserSession, isBrowserbaseConfigured } from './session'
import type { BrowserPlaybook, PlaybookResult, StartBrowserAgentRunInput } from './types'

const PRACTICE_CONCURRENCY = 2

export async function startBrowserAgentRun(
  input: StartBrowserAgentRunInput
): Promise<{ runId: string; status: string; result?: PlaybookResult }> {
  const playbook = getPlaybook(input.playbookId)
  if (!playbook) {
    throw new Error(`Unknown playbook: ${input.playbookId}`)
  }

  const useMock =
    input.useMock === true ||
    process.env.BROWSER_AGENT_USE_MOCK === '1' ||
    (!isBrowserbaseConfigured() && input.useMock !== false)

  const run = await prisma.browserAgentRun.create({
    data: {
      practiceId: input.practiceId,
      playbookId: playbook.id,
      site: playbook.site,
      status: 'pending',
      input: input.input as Prisma.InputJsonValue,
      eligibilityCheckId: input.eligibilityCheckId || null,
    },
  })

  if (input.sync || useMock) {
    const result = await executeBrowserAgentRun(run.id, { forceMock: useMock })
    return { runId: run.id, status: result.ok ? 'complete' : 'failed', result }
  }

  await inngest.send({
    name: 'browser-agent/run.requested',
    data: {
      practiceId: input.practiceId,
      runId: run.id,
      playbookId: playbook.id,
    },
  })

  return { runId: run.id, status: 'pending' }
}

export async function executeBrowserAgentRun(
  runId: string,
  opts?: { forceMock?: boolean }
): Promise<PlaybookResult> {
  const run = await prisma.browserAgentRun.findUnique({ where: { id: runId } })
  if (!run) {
    return { ok: false, errorMessage: 'Browser agent run not found' }
  }

  const playbook = getPlaybook(run.playbookId)
  if (!playbook) {
    await failRun(runId, `Unknown playbook: ${run.playbookId}`)
    return { ok: false, errorMessage: `Unknown playbook: ${run.playbookId}` }
  }

  const activeCount = await prisma.browserAgentRun.count({
    where: {
      practiceId: run.practiceId,
      status: 'running',
      id: { not: runId },
    },
  })
  if (activeCount >= PRACTICE_CONCURRENCY) {
    await failRun(runId, `Practice concurrency limit (${PRACTICE_CONCURRENCY}) exceeded`)
    return {
      ok: false,
      errorMessage: `Practice concurrency limit (${PRACTICE_CONCURRENCY}) exceeded`,
      escalateToVoice: true,
    }
  }

  const startedAt = new Date()
  await prisma.browserAgentRun.update({
    where: { id: runId },
    data: { status: 'running', startedAt, errorMessage: null },
  })

  const credential = await getBrowserCredential(run.practiceId, playbook.site)
  const useMock =
    opts?.forceMock === true ||
    process.env.BROWSER_AGENT_USE_MOCK === '1' ||
    (!isBrowserbaseConfigured() && !credential)

  // Live Availity (and similar) require credentials unless mocking
  if (!useMock && playbook.site !== 'smoke' && !credential) {
    const msg = `No active browser credentials for site=${playbook.site}`
    await failRun(runId, msg)
    return { ok: false, errorMessage: msg, escalateToVoice: true }
  }

  let session: Awaited<ReturnType<typeof createBrowserSession>> | null = null
  const logs: string[] = []

  try {
    if (playbook.requiresBrowser && !useMock) {
      session = await createBrowserSession({
        practiceId: run.practiceId,
        playbookId: playbook.id,
      })
      await prisma.browserAgentRun.update({
        where: { id: runId },
        data: { sessionId: session.sessionId },
      })
    }

    const result = await playbook.run({
      practiceId: run.practiceId,
      runId,
      credential,
      useMock,
      input: (run.input as Record<string, unknown>) || {},
      session,
      log: (message, meta) => {
        logs.push(message)
        console.info(`[browser-agent:${playbook.id}] ${message}`, {
          runId,
          practiceId: run.practiceId,
          ...meta,
        })
      },
    })

    const completedAt = new Date()
    await prisma.browserAgentRun.update({
      where: { id: runId },
      data: {
        status: result.ok ? 'complete' : 'failed',
        output: {
          ...(result.output || {}),
          logs: logs.slice(-50),
          escalateToVoice: result.escalateToVoice || false,
        },
        errorMessage: result.errorMessage || null,
        artifactUrls: result.artifactUrls || undefined,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    })

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Browser agent run failed'
    await failRun(runId, message, startedAt)
    return { ok: false, errorMessage: message, escalateToVoice: true }
  } finally {
    if (session) {
      await session.close().catch(() => undefined)
    }
  }
}

async function failRun(runId: string, errorMessage: string, startedAt?: Date) {
  const completedAt = new Date()
  await prisma.browserAgentRun.update({
    where: { id: runId },
    data: {
      status: 'failed',
      errorMessage: errorMessage.slice(0, 1000),
      completedAt,
      durationMs: startedAt ? completedAt.getTime() - startedAt.getTime() : undefined,
    },
  })
}

export function getPlaybookOrThrow(playbookId: string): BrowserPlaybook {
  const playbook = getPlaybook(playbookId)
  if (!playbook) throw new Error(`Unknown playbook: ${playbookId}`)
  return playbook
}
