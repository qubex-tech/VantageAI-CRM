import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSmartSettings, upsertSmartSettings, resolveSmartPractice } from '@/lib/integrations/smart/server'

const settingsSchema = z.object({
  enabled: z.boolean(),
  issuer: z.string().url().optional(),
  fhirBaseUrl: z.string().url().optional(),
  clientId: z.string().min(3).optional(),
  enableWrite: z.boolean().optional(),
  enablePatientCreate: z.boolean().optional(),
  enableNoteCreate: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveSmartPractice(practiceIdOverride)
    const settings = await getSmartSettings(practiceId)
    return NextResponse.json({ settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsedBody = await req.json().catch(() => ({}))
    const practiceIdOverride =
      typeof parsedBody.practiceId === 'string' ? parsedBody.practiceId : undefined
    const { practiceId } = await resolveSmartPractice(practiceIdOverride)
    const parsed = settingsSchema.safeParse(parsedBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
    }
    const settings = await upsertSmartSettings(practiceId, parsed.data)
    return NextResponse.json({ settings: settings.smartFhir })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
