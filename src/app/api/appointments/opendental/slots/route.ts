import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getSchedulingSettings } from '@/lib/integrations/clinical-system/server'
import {
  getOpenDentalOpenSlots,
  DEFAULT_SLOT_LENGTH_MINUTES,
} from '@/lib/integrations/opendental/scheduling'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }
    const practiceId = user.practiceId
    const sp = req.nextUrl.searchParams

    const scheduling = await getSchedulingSettings(practiceId)

    const dateStart = sp.get('dateStart') || sp.get('date') || ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStart)) {
      return NextResponse.json({ error: 'A valid dateStart (yyyy-MM-dd) is required' }, { status: 400 })
    }
    const dateEnd = sp.get('dateEnd') || undefined

    const provNum = Number(sp.get('provNum')) || scheduling.defaultProvNum || undefined
    const opNum = Number(sp.get('opNum')) || scheduling.defaultOperatoryNum || undefined
    const lengthMinutes =
      Number(sp.get('lengthMinutes')) || scheduling.defaultLengthMinutes || DEFAULT_SLOT_LENGTH_MINUTES

    const slots = await getOpenDentalOpenSlots({
      practiceId,
      provNum,
      opNum,
      dateStart,
      dateEnd,
      lengthMinutes,
    })

    return NextResponse.json({ slots })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch Open Dental slots'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
