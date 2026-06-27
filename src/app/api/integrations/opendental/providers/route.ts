import { NextRequest, NextResponse } from 'next/server'
import { resolveOpenDentalPractice } from '@/lib/integrations/opendental/server'
import { listOpenDentalProviders } from '@/lib/integrations/opendental/scheduling'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveOpenDentalPractice(practiceIdOverride)
    const providers = await listOpenDentalProviders(practiceId)
    return NextResponse.json({ providers })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Open Dental providers'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
