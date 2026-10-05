import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { isAriaScribeEnabled } from '@/lib/aria/enabled'
import { glassesFeatureStatus } from '@/lib/glasses/healthcare-gate'

export const dynamic = 'force-dynamic'

/**
 * GET /api/mobile/features
 * Bootstrap feature flags for the mobile app (practice-scoped).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const ariaScribeEnabled = await isAriaScribeEnabled(user.practiceId)

    return NextResponse.json({
      ariaScribeEnabled,
      glasses: glassesFeatureStatus(),
      agents: {
        aria: {
          enabled: ariaScribeEnabled,
          label: 'Aria',
        },
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
