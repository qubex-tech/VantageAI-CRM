import { NextRequest, NextResponse } from 'next/server'
import { resolveClinicalSystemPractice } from '@/lib/integrations/clinical-system/server'
import { syncNexhealthPractice } from '@/lib/integrations/nexhealth/scheduledSync'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const practiceIdOverride =
      (typeof body.practiceId === 'string' ? body.practiceId : undefined) ||
      req.nextUrl.searchParams.get('practiceId') ||
      undefined
    const { practiceId } = await resolveClinicalSystemPractice(practiceIdOverride)
    const result = await syncNexhealthPractice(practiceId)
    const status = result.status === 'error' ? 500 : 200
    return NextResponse.json(result, { status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync NexHealth'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
