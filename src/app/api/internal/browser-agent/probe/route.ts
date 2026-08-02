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
  return NextResponse.json({
    ok: true,
    browserbaseConfigured: isBrowserbaseConfigured(),
    apiKeyLen: (process.env.BROWSERBASE_API_KEY || '').length,
    projectIdLen: (process.env.BROWSERBASE_PROJECT_ID || '').length,
  })
}
