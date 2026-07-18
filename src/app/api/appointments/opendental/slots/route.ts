import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getSchedulingSettings } from '@/lib/integrations/clinical-system/server'
import {
  resolveOdReadConfigs,
  resolveReadConfigsForVisitType,
  resolveReadLengthMinutes,
  resolveReadOperatoryNums,
  resolveReadProvNum,
  resolveVisitTypeFromNaturalLanguage,
  usesOpenDentalForRead,
} from '@/lib/integrations/clinical-system/types'
import {
  getOpenDentalOpenSlots,
  getOpenDentalOpenSlotsForOperatories,
  getOpenDentalOpenSlotsForReadConfigs,
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
    if (!usesOpenDentalForRead(scheduling)) {
      return NextResponse.json(
        { error: 'Open Dental is not configured as the availability source for this practice.' },
        { status: 400 }
      )
    }

    const dateStart = sp.get('dateStart') || sp.get('date') || ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStart)) {
      return NextResponse.json({ error: 'A valid dateStart (yyyy-MM-dd) is required' }, { status: 400 })
    }
    const dateEnd = sp.get('dateEnd') || undefined

    const appointmentType = sp.get('appointmentType') || sp.get('visitType') || ''
    const visitType = appointmentType
      ? resolveVisitTypeFromNaturalLanguage(scheduling, appointmentType) || appointmentType
      : null

    const provNumOverride = Number(sp.get('provNum')) || undefined
    const opNumOverride = Number(sp.get('opNum')) || undefined
    const lengthMinutes =
      Number(sp.get('lengthMinutes')) ||
      resolveReadLengthMinutes(scheduling) ||
      DEFAULT_SLOT_LENGTH_MINUTES

    if (opNumOverride || provNumOverride) {
      const slots = opNumOverride
        ? await getOpenDentalOpenSlots({
            practiceId,
            provNum: provNumOverride || resolveReadProvNum(scheduling) || undefined,
            opNum: opNumOverride,
            dateStart,
            dateEnd,
            lengthMinutes,
          })
        : await getOpenDentalOpenSlotsForOperatories({
            practiceId,
            provNum: provNumOverride || resolveReadProvNum(scheduling) || undefined,
            opNums: resolveReadOperatoryNums(scheduling),
            dateStart,
            dateEnd,
            lengthMinutes,
          })
      return NextResponse.json({ slots, visitType })
    }

    const readConfigs = resolveReadConfigsForVisitType(scheduling, visitType)
    const configs =
      readConfigs.length > 0
        ? readConfigs
        : resolveOdReadConfigs(scheduling)

    if (configs.length === 0) {
      return NextResponse.json(
        { error: 'No Open Dental reading time-slot providers/operatories are configured.' },
        { status: 400 }
      )
    }

    const slots = await getOpenDentalOpenSlotsForReadConfigs({
      practiceId,
      configs,
      dateStart,
      dateEnd,
    })

    return NextResponse.json({ slots, visitType })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch Open Dental slots'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
