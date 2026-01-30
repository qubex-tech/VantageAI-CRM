import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSmartSettings, upsertSmartSettings, requireSmartUser } from '@/lib/integrations/smart/server'

const settingsSchema = z.object({
  enabled: z.boolean(),
  issuer: z.string().url().optional(),
  fhirBaseUrl: z.string().url().optional(),
  clientId: z.string().min(3).optional(),
  enableWrite: z.boolean().optional(),
  enablePatientCreate: z.boolean().optional(),
  enableNoteCreate: z.boolean().optional(),
})

export async function GET() {
  try {
    const { practiceId } = await requireSmartUser()
    const settings = await getSmartSettings(practiceId)
    return NextResponse.json({ settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { practiceId } = await requireSmartUser()
    const parsed = settingsSchema.safeParse(await req.json().catch(() => ({})))
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
