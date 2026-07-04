import { NextRequest, NextResponse } from 'next/server'
import { resolveClinicalSystemPractice } from '@/lib/integrations/clinical-system/server'
import { listEhrPractitionersForPractice } from '@/lib/integrations/ehr/scheduleSync'

export const dynamic = 'force-dynamic'

/** GET /api/integrations/ehr/practitioners — list eCW practitioners for scheduling settings. */
export async function GET(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveClinicalSystemPractice(practiceIdOverride)
    const practitioners = await listEhrPractitionersForPractice(practiceId)
    return NextResponse.json({ practitioners })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load eCW practitioners'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
