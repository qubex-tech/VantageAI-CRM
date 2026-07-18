import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { canManagePractice, isVantageAdmin } from '@/lib/permissions'

const updateSchema = z.object({
  enabled: z.boolean(),
})

function normalizeUser(user: Awaited<ReturnType<typeof requireAuth>>) {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    practiceId: user.practiceId,
    role: user.role,
  }
}

function resolvePracticeId(req: NextRequest, user: Awaited<ReturnType<typeof requireAuth>>) {
  const queryPracticeId = req.nextUrl.searchParams.get('practiceId')
  if (queryPracticeId && isVantageAdmin(normalizeUser(user))) {
    return queryPracticeId
  }
  return user.practiceId
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = resolvePracticeId(req, user)

    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const settings = await prisma.practiceSettings.findUnique({
      where: { practiceId },
      select: { ariaScribeEnabled: true },
    })

    return NextResponse.json({
      enabled: Boolean(settings?.ariaScribeEnabled),
      agent: 'aria',
      label: 'Aria — Scribe Agent',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Aria settings' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = resolvePracticeId(req, user)

    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    if (!canManagePractice(normalizeUser(user), practiceId)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = updateSchema.parse(await req.json())

    const settings = await prisma.practiceSettings.upsert({
      where: { practiceId },
      update: { ariaScribeEnabled: body.enabled },
      create: { practiceId, ariaScribeEnabled: body.enabled },
      select: { ariaScribeEnabled: true },
    })

    return NextResponse.json({
      enabled: settings.ariaScribeEnabled,
      agent: 'aria',
      label: 'Aria — Scribe Agent',
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update Aria settings' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
