import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getClinicalIntegrationSettings,
  resolveClinicalSystemPractice,
  upsertClinicalIntegrationSettings,
} from '@/lib/integrations/clinical-system/server'
import { CLINICAL_SYSTEM_TYPES } from '@/lib/integrations/clinical-system/types'

const settingsSchema = z.object({
  system: z.enum(CLINICAL_SYSTEM_TYPES),
})

export async function GET(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveClinicalSystemPractice(practiceIdOverride)
    const result = await getClinicalIntegrationSettings(practiceId)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load clinical system settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const practiceIdOverride = typeof body.practiceId === 'string' ? body.practiceId : undefined
    const { practiceId } = await resolveClinicalSystemPractice(practiceIdOverride)
    const parsed = settingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid clinical system settings' }, { status: 400 })
    }

    await upsertClinicalIntegrationSettings(practiceId, parsed.data)
    const result = await getClinicalIntegrationSettings(practiceId)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update clinical system settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
