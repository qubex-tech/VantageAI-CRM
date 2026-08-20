import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import {
  getClearinghouseAdapter,
  getPracticeEligibilitySettings,
} from '@/lib/eligibility/clearinghouse'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const queryPracticeId = req.nextUrl.searchParams.get('practiceId')
    let practiceId: string | null = user.practiceId
    if (queryPracticeId && isVantageAdmin({ ...user, name: user.name ?? null })) {
      practiceId = queryPracticeId
    }
    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const vendorOverride = req.nextUrl.searchParams.get('vendor')
    const settings = await getPracticeEligibilitySettings(practiceId)
    const vendorKey = vendorOverride || settings.primaryVendorKey
    const adapter = getClearinghouseAdapter(vendorKey)
    const configured = await adapter.isConfigured(practiceId)
    if (!configured) {
      return NextResponse.json({
        vendorKey: adapter.vendorKey,
        vendorDisplayName: adapter.displayName,
        payers: [],
        error: `${adapter.displayName} is not configured for this practice`,
      })
    }
    const q = req.nextUrl.searchParams.get('q') || undefined
    const payers = await adapter.searchPayers(practiceId, q)

    return NextResponse.json({
      vendorKey: adapter.vendorKey,
      vendorDisplayName: adapter.displayName,
      payers,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search payers' },
      { status: 500 }
    )
  }
}
