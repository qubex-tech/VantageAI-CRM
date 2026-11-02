import { NextRequest, NextResponse } from 'next/server'
import { resolveClinicalSystemPractice } from '@/lib/integrations/clinical-system/server'
import { isNexhealthKeyConfigured } from '@/lib/integrations/nexhealth/client'
import {
  disconnectNexhealth,
  getNexhealthConnection,
  publicNexhealthConnection,
} from '@/lib/integrations/nexhealth/connection'

export async function GET(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveClinicalSystemPractice(practiceIdOverride)
    const connection = await getNexhealthConnection(practiceId)
    return NextResponse.json({
      connection: publicNexhealthConnection(connection),
      sandboxKeyConfigured: isNexhealthKeyConfigured('sandbox'),
      productionKeyConfigured: isNexhealthKeyConfigured('production'),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load NexHealth configuration'
    const status = message === 'Not authenticated' || message === 'Permission denied' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveClinicalSystemPractice(practiceIdOverride)
    await disconnectNexhealth(practiceId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to disconnect NexHealth'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
