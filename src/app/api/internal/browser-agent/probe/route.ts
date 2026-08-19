import { NextRequest, NextResponse } from 'next/server'
import {
  applyBrowserRunToEligibilityCheck,
  executeBrowserAgentRun,
  isBrowserbaseConfigured,
  runAvailityRpaEligibility,
} from '@/lib/browser-agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authorize(req: NextRequest): boolean {
  const expected = process.env.EHR_BACKEND_API_KEY?.trim()
  if (!expected) return false
  const header = req.headers.get('authorization') || ''
  return header === `Bearer ${expected}`
}

/**
 * Temporary/ops probe for portal RPA on production (Sensitive Browserbase env vars
 * are not readable via `vercel env pull`).
 *
 * POST { runId } — execute an existing BrowserAgentRun
 * POST { practiceId, patientId, policyId? } — start + execute Availity eligibility sync
 */
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()

    if (body?.runId) {
      const result = await executeBrowserAgentRun(String(body.runId), {
        forceMock: body.forceMock === true,
      })
      const applied = await applyBrowserRunToEligibilityCheck(String(body.runId))
      return NextResponse.json({
        browserbaseConfigured: isBrowserbaseConfigured(),
        result,
        applied,
      })
    }

    if (body?.practiceId && body?.patientId) {
      const rpa = await runAvailityRpaEligibility({
        practiceId: String(body.practiceId),
        userId: String(body.userId || body.practiceId),
        patientId: String(body.patientId),
        policyId: body.policyId ? String(body.policyId) : undefined,
        sync: true,
      })
      return NextResponse.json({
        browserbaseConfigured: isBrowserbaseConfigured(),
        rpa,
      })
    }

    return NextResponse.json(
      {
        error: 'Provide runId, or practiceId+patientId',
        browserbaseConfigured: isBrowserbaseConfigured(),
      },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Probe failed',
        browserbaseConfigured: isBrowserbaseConfigured(),
      },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = (process.env.BROWSERBASE_API_KEY || '').trim()
  const projectId = (process.env.BROWSERBASE_PROJECT_ID || '').trim()
  const smoke = req.nextUrl.searchParams.get('smoke') === '1'
  const stagehandSmoke = req.nextUrl.searchParams.get('stagehand') === '1'

  const base = {
    ok: true as const,
    browserbaseConfigured: isBrowserbaseConfigured(),
    apiKeyLen: apiKey.length,
    apiKeySuffix: apiKey ? apiKey.slice(-4) : null,
    projectId: projectId || null,
    projectIdLen: projectId.length,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    browserAgentLlm: process.env.BROWSER_AGENT_LLM || null,
    browserAgentUseMock: process.env.BROWSER_AGENT_USE_MOCK || null,
  }

  if (!smoke && !stagehandSmoke) {
    return NextResponse.json(base)
  }

  const results: Record<string, unknown> = { ...base }

  if (smoke) {
    try {
      const { default: Browserbase } = await import('@browserbasehq/sdk')
      const bb = new Browserbase({ apiKey })
      const created = await bb.sessions.create({
        ...(projectId ? { projectId } : {}),
        browserSettings: { viewport: { width: 1280, height: 720 } },
      })
      await bb.sessions.update(created.id, { status: 'REQUEST_RELEASE' }).catch(() => undefined)
      results.sdkSmoke = { ok: true, sessionId: created.id, projectId: created.projectId }
    } catch (error) {
      results.sdkSmoke = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : undefined,
        // SDK often attaches status on the error object
        status:
          error && typeof error === 'object' && 'status' in error
            ? (error as { status?: unknown }).status
            : undefined,
      }
    }
  }

  if (stagehandSmoke) {
    try {
      const { createStagehandAssist } = await import('@/lib/browser-agent/stagehand-session')
      const assist = await createStagehandAssist({
        practiceId: 'probe',
        playbookId: 'probe',
      })
      const sessionId = assist.sessionId
      await assist.close()
      results.stagehandSmoke = { ok: true, sessionId }
    } catch (error) {
      const cause =
        error instanceof Error && error.cause instanceof Error
          ? error.cause.message
          : error instanceof Error && error.cause
            ? String(error.cause)
            : undefined
      results.stagehandSmoke = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        cause,
        name: error instanceof Error ? error.name : undefined,
        status:
          error && typeof error === 'object' && 'status' in error
            ? (error as { status?: unknown }).status
            : undefined,
        extensionIdConfigured: Boolean(
          process.env.BROWSERBASE_STAGEHAND_EXTENSION_ID?.trim()
        ),
      }
    }
  }

  return NextResponse.json(results)
}
