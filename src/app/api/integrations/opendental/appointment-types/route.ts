import { NextRequest, NextResponse } from 'next/server'
import { resolveOpenDentalPractice } from '@/lib/integrations/opendental/server'
import { listOpenDentalAppointmentTypes } from '@/lib/integrations/opendental/scheduling'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveOpenDentalPractice(practiceIdOverride)
    const appointmentTypes = await listOpenDentalAppointmentTypes(practiceId)
    return NextResponse.json({
      appointmentTypes: appointmentTypes.filter((t) => !t.isHidden),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load Open Dental appointment types'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
