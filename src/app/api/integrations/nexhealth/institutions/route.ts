import { NextRequest, NextResponse } from 'next/server'
import { resolveClinicalSystemPractice } from '@/lib/integrations/clinical-system/server'
import { isNexhealthKeyConfigured, listNexhealthInstitutions } from '@/lib/integrations/nexhealth/client'
import type { NexhealthEnvironment } from '@/lib/integrations/nexhealth/types'

export async function GET(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    await resolveClinicalSystemPractice(practiceIdOverride)
    const environment = req.nextUrl.searchParams.get('environment') === 'production' ? 'production' : 'sandbox'
    const env = environment as NexhealthEnvironment
    if (!isNexhealthKeyConfigured(env)) {
      const keyName = env === 'production' ? 'NEXHEALTH_API_KEY' : 'NEXHEALTH_SANDBOX_API_KEY'
      return NextResponse.json({ error: `${keyName} is not configured` }, { status: 400 })
    }
    const institutions = await listNexhealthInstitutions(env)
    return NextResponse.json({ institutions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load NexHealth institutions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
