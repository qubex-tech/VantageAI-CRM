import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getSchedulingSettings } from '@/lib/integrations/clinical-system/server'
import { usesEcwForRead, resolveReadLengthMinutes } from '@/lib/integrations/clinical-system/types'
import { getEcwScheduleFromSettings } from '@/lib/integrations/ehr/scheduling'
import { DEFAULT_ECW_SLOT_LENGTH_MINUTES } from '@/lib/integrations/ehr/scheduling'

export const dynamic = 'force-dynamic'

/** GET /api/appointments/ecw/slots — open slots + synced appointments from eClinicalWorks. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }
    const practiceId = user.practiceId
    const sp = req.nextUrl.searchParams

    const scheduling = await getSchedulingSettings(practiceId)
    if (!usesEcwForRead(scheduling)) {
      return NextResponse.json(
        { error: 'eClinicalWorks is not configured as the availability source for this practice.' },
        { status: 400 }
      )
    }

    const dateStart = sp.get('dateStart') || sp.get('date') || ''
    const dateEnd = sp.get('dateEnd') || dateStart
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStart) || !/^\d{4}-\d{2}-\d{2}$/.test(dateEnd)) {
      return NextResponse.json(
        { error: 'Valid dateStart and dateEnd (yyyy-MM-dd) are required' },
        { status: 400 }
      )
    }

    const practitionerRef = sp.get('practitionerRef') || undefined
    const practitionerRefsParam = sp.get('practitionerRefs') || ''
    const practitionerRefs = practitionerRefsParam
      ? practitionerRefsParam.split(',').map((value) => value.trim()).filter(Boolean)
      : undefined
    const lengthMinutes =
      Number(sp.get('lengthMinutes')) ||
      resolveReadLengthMinutes(scheduling) ||
      DEFAULT_ECW_SLOT_LENGTH_MINUTES

    const result = await getEcwScheduleFromSettings({
      practiceId,
      scheduling,
      dateStart,
      dateEnd,
      practitionerRef,
      practitionerRefs,
      lengthMinutes,
      timeZone: sp.get('timezone') || undefined,
    })

    return NextResponse.json({
      slots: result.slots,
      appointments: result.appointments,
      practitionerRefs: result.practitionerRefs,
      source: 'ecw',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch eCW schedule'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
