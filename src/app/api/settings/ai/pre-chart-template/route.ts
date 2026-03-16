import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { canManagePractice, isVantageAdmin } from '@/lib/permissions'
import { preVisitTemplateSchema } from '@/lib/validations'
import { DEFAULT_PREVISIT_TEMPLATE } from '@/lib/previsit/template'

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
  const normalizedUser = normalizeUser(user)
  const queryPracticeId = req.nextUrl.searchParams.get('practiceId')

  if (queryPracticeId && isVantageAdmin(normalizedUser)) {
    return queryPracticeId
  }

  return user.practiceId
}

function isTemplateColumnMissing(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  return error.code === 'P2022' && error.message.includes('healixPreChartTemplate')
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
      select: { healixPreChartTemplate: true },
    })

    return NextResponse.json({
      template: settings?.healixPreChartTemplate ?? DEFAULT_PREVISIT_TEMPLATE,
    })
  } catch (error) {
    if (isTemplateColumnMissing(error)) {
      return NextResponse.json({
        template: DEFAULT_PREVISIT_TEMPLATE,
        warning:
          'Pre-Visit template column is not available yet. Run `npx prisma migrate deploy` in this environment.',
      })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load pre-chart template' },
      { status: 500 }
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

    const normalizedUser = normalizeUser(user)
    if (!canManagePractice(normalizedUser, practiceId)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await req.json()
    const template = preVisitTemplateSchema.parse(body)

    const settings = await prisma.practiceSettings.upsert({
      where: { practiceId },
      update: {
        healixPreChartTemplate: template,
      },
      create: {
        practiceId,
        healixPreChartTemplate: template,
      },
      select: { healixPreChartTemplate: true },
    })

    return NextResponse.json({ template: settings.healixPreChartTemplate })
  } catch (error) {
    if (isTemplateColumnMissing(error)) {
      return NextResponse.json(
        {
          error:
            'Pre-Visit template migration has not been applied. Run `npx prisma migrate deploy` in this environment.',
          code: 'MIGRATION_REQUIRED',
        },
        { status: 503 }
      )
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update pre-chart template' },
      { status: 500 }
    )
  }
}
