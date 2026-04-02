import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { syncEhrAppointmentsForPractice } from '@/lib/integrations/ehr/scheduleSync'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const result = await syncEhrAppointmentsForPractice(user.practiceId, { force: true })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync EHR appointments' },
      { status: 500 }
    )
  }
}
