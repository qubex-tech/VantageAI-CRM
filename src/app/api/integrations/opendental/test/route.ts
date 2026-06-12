import { NextRequest, NextResponse } from 'next/server'
import { getOpenDentalServices } from '@/lib/integrations/opendental/factory'
import { resolveOpenDentalPractice } from '@/lib/integrations/opendental/server'

export async function GET(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveOpenDentalPractice(practiceIdOverride)
    const services = await getOpenDentalServices(practiceId)

    const [preferences, clinics] = await Promise.all([
      services.preferences.list({ PrefName: 'ProgramVersion' }),
      services.clinics.list(),
    ])

    return NextResponse.json({
      ok: true,
      preferencesCount: Array.isArray(preferences) ? preferences.length : 0,
      clinicsCount: Array.isArray(clinics) ? clinics.length : 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Open Dental smoke test failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
