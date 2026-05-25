import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import {
  getEhrAppointmentSyncStatusForPractice,
  syncEhrAppointmentsForPractice,
  type SyncOptions,
} from '@/lib/integrations/ehr/scheduleSync'

const MANUAL_SYNC_DEFAULT_BUSINESS_DAYS = 21
const MANUAL_BACKFILL_PAST_DAYS = 34
const MANUAL_BACKFILL_FUTURE_DAYS = 21

function formatChicagoDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function shiftChicagoDays(offset: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offset)
  return formatChicagoDate(date)
}

function parseSyncOptionsFromRequest(req: NextRequest): SyncOptions {
  const searchParams = req.nextUrl.searchParams
  const from = searchParams.get('from')?.trim()
  const to = searchParams.get('to')?.trim()
  const daysRaw = searchParams.get('days')?.trim()

  const options: SyncOptions = { force: true }

  if (from && to) {
    options.startDate = from
    options.endDate = to
    return options
  }

  if (daysRaw) {
    const days = Number.parseInt(daysRaw, 10)
    if (days > 0 && days <= 90) {
      options.businessDays = days
    }
    return options
  }

  // Default manual sync: backfill recent past + forward horizon.
  options.startDate = shiftChicagoDays(-MANUAL_BACKFILL_PAST_DAYS)
  options.endDate = shiftChicagoDays(MANUAL_BACKFILL_FUTURE_DAYS)
  options.businessDays = MANUAL_SYNC_DEFAULT_BUSINESS_DAYS
  return options
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const status = await getEhrAppointmentSyncStatusForPractice(user.practiceId)
    return NextResponse.json({ success: true, status })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch EHR sync status' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const syncOptions = parseSyncOptionsFromRequest(req)
    const result = await syncEhrAppointmentsForPractice(user.practiceId, syncOptions)
    const status = await getEhrAppointmentSyncStatusForPractice(user.practiceId)

    return NextResponse.json({ success: true, result, status })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync EHR appointments' },
      { status: 500 }
    )
  }
}
