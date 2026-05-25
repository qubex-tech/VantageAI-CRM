import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin, canManagePractice } from '@/lib/permissions'
import { outboundAgentsSettingsSchema } from '@/lib/validations'
import {
  getOutboundAgentsSettings,
  saveOutboundAgentsSettings,
  parseOutboundAgentsSettings,
} from '@/lib/appointment-optimization/settings'

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

    const settings = await getOutboundAgentsSettings(practiceId)
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load settings' },
      { status: 500 }
    )
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

    const validated = outboundAgentsSettingsSchema.parse(body.settings ?? body)
    await saveOutboundAgentsSettings(practiceId, parseOutboundAgentsSettings(validated))
    return NextResponse.json({ settings: validated })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save settings' },
      { status: 500 }
    )
  }
}
