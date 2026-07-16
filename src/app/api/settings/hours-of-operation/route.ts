import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin, canManagePractice } from '@/lib/permissions'
import { hoursOfOperationSettingsSchema } from '@/lib/validations'
import {
  extractHoursOfOperationTimezone,
  getHoursOfOperationSettings,
  saveHoursOfOperationSettings,
} from '@/lib/practice-hours/settings'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = req.nextUrl.searchParams.get('practiceId') || user.practiceId
    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID required' }, { status: 400 })
    }

    const permissionsUser = {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      practiceId: user.practiceId,
      role: user.role,
    }
    if (
      !isVantageAdmin(permissionsUser) &&
      !canManagePractice(permissionsUser, practiceId)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const settings = await getHoursOfOperationSettings(practiceId)
    // Until Hours of Operation has an explicit timezone saved, show the resolved
    // practice zone (Brand Profile → default) so the UI matches booking/voice.
    const stored = await prisma.practiceSettings.findUnique({
      where: { practiceId },
      select: { hoursOfOperation: true },
    })
    if (!extractHoursOfOperationTimezone(stored?.hoursOfOperation)) {
      settings.timezone = await getPracticeTimeZone(practiceId)
    }
    return NextResponse.json({ settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load settings'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()
    const practiceId = body.practiceId || user.practiceId
    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID required' }, { status: 400 })
    }

    const permissionsUser = {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      practiceId: user.practiceId,
      role: user.role,
    }
    if (
      !isVantageAdmin(permissionsUser) &&
      !canManagePractice(permissionsUser, practiceId)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const validated = hoursOfOperationSettingsSchema.parse(body.settings ?? body)
    await saveHoursOfOperationSettings(practiceId, validated)
    const settings = await getHoursOfOperationSettings(practiceId)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', details: error }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Failed to save settings'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
