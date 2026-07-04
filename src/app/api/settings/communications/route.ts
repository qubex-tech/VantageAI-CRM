import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin, canManagePractice } from '@/lib/permissions'
import { communicationsSettingsSchema } from '@/lib/validations'

type CommunicationPlatform = 'none' | 'curogram' | 'weave' | 'us_telekom'

const SETTINGS_KEY = 'communicationIntegrationPlatform'

function normalizeUser(user: Awaited<ReturnType<typeof requireAuth>>) {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    practiceId: user.practiceId,
    role: user.role,
  }
}

function canAccessPractice(user: Awaited<ReturnType<typeof requireAuth>>, practiceId: string): boolean {
  const normalized = normalizeUser(user)
  return isVantageAdmin(normalized) || canManagePractice(normalized, practiceId)
}

function parseStoredPlatform(value: unknown): CommunicationPlatform {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'none'
  const raw = (value as Record<string, unknown>)[SETTINGS_KEY]
  if (raw === 'none' || raw === 'curogram' || raw === 'weave' || raw === 'us_telekom') {
    return raw
  }
  return 'none'
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = req.nextUrl.searchParams.get('practiceId') || user.practiceId

    if (!practiceId) {
      return NextResponse.json({ error: 'practiceId is required' }, { status: 400 })
    }

    if (!canAccessPractice(user, practiceId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const row = await prisma.practiceSettings.findUnique({
      where: { practiceId },
      select: { outboundCustomerNotifications: true },
    })

    return NextResponse.json({
      settings: {
        platform: parseStoredPlatform(row?.outboundCustomerNotifications),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load communications settings' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const practiceId = body.practiceId || user.practiceId

    if (!practiceId) {
      return NextResponse.json({ error: 'practiceId is required' }, { status: 400 })
    }

    if (!canAccessPractice(user, practiceId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const validated = communicationsSettingsSchema.parse(body.settings ?? body)
    const existing = await prisma.practiceSettings.findUnique({
      where: { practiceId },
      select: { outboundCustomerNotifications: true },
    })
    const existingOutbound =
      existing?.outboundCustomerNotifications &&
      typeof existing.outboundCustomerNotifications === 'object' &&
      !Array.isArray(existing.outboundCustomerNotifications)
        ? (existing.outboundCustomerNotifications as Record<string, unknown>)
        : {}

    const outboundCustomerNotifications = {
      ...existingOutbound,
      [SETTINGS_KEY]: validated.platform,
    }

    await prisma.practiceSettings.upsert({
      where: { practiceId },
      create: {
        practiceId,
        outboundCustomerNotifications,
      },
      update: {
        outboundCustomerNotifications,
      },
    })

    return NextResponse.json({
      settings: {
        platform: validated.platform,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save communications settings' },
      { status: 500 }
    )
  }
}
