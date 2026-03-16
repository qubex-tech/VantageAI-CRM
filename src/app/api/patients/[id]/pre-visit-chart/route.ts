import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { preVisitChartGenerateSchema } from '@/lib/validations'
import { DEFAULT_PREVISIT_TEMPLATE } from '@/lib/previsit/template'
import { buildPatientEvidenceBundle } from '@/lib/previsit/evidence'
import { generatePreVisitChart } from '@/lib/previsit/generate'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isPreVisitMigrationMissing(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code === 'P2021' && error.message.includes('pre_visit_charts')) return true
  if (error.code === 'P2022' && error.message.includes('healixPreChartTemplate')) return true
  return false
}

function isLikelyTimeoutOrTermination(error: unknown) {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('terminated') ||
    message.includes('abort') ||
    message.includes('timed out') ||
    message.includes('timeout')
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id: patientId } = await params

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const chart = await prisma.preVisitChart.findFirst({
      where: {
        practiceId: user.practiceId,
        patientId,
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (!chart) {
      return NextResponse.json({ chart: null })
    }

    return NextResponse.json({ chart })
  } catch (error) {
    if (isPreVisitMigrationMissing(error)) {
      return NextResponse.json(
        {
          error:
            'Pre-Visit Charting database migration has not been applied. Run `npx prisma migrate deploy` in this environment.',
          code: 'MIGRATION_REQUIRED',
        },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load pre-visit chart' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let createdChartId: string | null = null
  let actorUserId: string | null = null
  let actorPracticeId: string | null = null
  let contextPatientId: string | null = null
  try {
    const user = await requireAuth(req)
    const { id: patientId } = await params
    actorUserId = user.id
    actorPracticeId = user.practiceId || null
    contextPatientId = patientId

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const body = await req.json()
    const payload = preVisitChartGenerateSchema.parse(body)

    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        practiceId: user.practiceId,
        deletedAt: null,
      },
      select: { id: true },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const settings = await prisma.practiceSettings.findUnique({
      where: { practiceId: user.practiceId },
      select: { healixPreChartTemplate: true },
    })

    const template = (settings?.healixPreChartTemplate as any) || DEFAULT_PREVISIT_TEMPLATE
    const evidenceBundle = await buildPatientEvidenceBundle({
      practiceId: user.practiceId,
      patientId,
    })

    const chartRecord = await prisma.preVisitChart.create({
      data: {
        practiceId: user.practiceId,
        patientId,
        chartType: payload.chartType,
        status: 'draft',
        templateSnapshot: template as Prisma.InputJsonValue,
        generatedSections: [],
        evidenceBundle: evidenceBundle as unknown as Prisma.InputJsonValue,
        createdByUserId: user.id,
      },
    })

    createdChartId = chartRecord.id

    const generated = await generatePreVisitChart({
      chartType: payload.chartType,
      template,
      evidenceItems: evidenceBundle.evidenceItems,
    })

    const chart = await prisma.preVisitChart.update({
      where: { id: chartRecord.id },
      data: {
        status: 'generated',
        generatedSections: generated.sections as unknown as Prisma.InputJsonValue,
        generationMeta: {
          ...generated.generationMeta,
          references: generated.references,
          forceRegenerate: payload.forceRegenerate || false,
        } as unknown as Prisma.InputJsonValue,
      },
    })

    await createAuditLog({
      practiceId: user.practiceId,
      userId: user.id,
      action: 'create',
      resourceType: 'patient',
      resourceId: patientId,
      changes: {
        after: {
          preVisitChartId: chart.id,
          chartType: chart.chartType,
          status: chart.status,
        },
      },
    })

    await prisma.healixActionLog.create({
      data: {
        practiceId: user.practiceId,
        userId: user.id,
        actionType: 'previsit_chart_generated',
        toolName: 'generatePreVisitChart',
        toolArgs: {
          patientId,
          chartType: payload.chartType,
        },
        toolResult: {
          chartId: chart.id,
          sectionCount: Array.isArray(chart.generatedSections) ? chart.generatedSections.length : 0,
        },
      },
    })

    return NextResponse.json({ chart })
  } catch (error) {
    if (isPreVisitMigrationMissing(error)) {
      return NextResponse.json(
        {
          error:
            'Pre-Visit Charting database migration has not been applied. Run `npx prisma migrate deploy` in this environment.',
          code: 'MIGRATION_REQUIRED',
        },
        { status: 503 }
      )
    }

    if (createdChartId) {
      await prisma.preVisitChart
        .update({
          where: { id: createdChartId },
          data: {
            status: 'failed',
            generationMeta: {
              error: error instanceof Error ? error.message : 'Unknown generation error',
              failedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          },
        })
        .catch(() => {
          // Best effort failure logging.
        })

      if (actorPracticeId && actorUserId) {
        await prisma.healixActionLog
          .create({
            data: {
              practiceId: actorPracticeId,
              userId: actorUserId,
              actionType: 'previsit_chart_failed',
              toolName: 'generatePreVisitChart',
              toolArgs: {
                patientId: contextPatientId,
              },
              toolResult: {
                chartId: createdChartId,
                error: error instanceof Error ? error.message : 'Unknown generation error',
              },
            },
          })
          .catch(() => {
            // Best effort failure logging.
          })
      }
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }

    if (isLikelyTimeoutOrTermination(error)) {
      return NextResponse.json(
        {
          error:
            'Pre-visit chart generation timed out while contacting the AI model. Please retry once. If it continues, reduce context volume for this patient and try again.',
          code: 'GENERATION_TIMEOUT',
        },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate pre-visit chart' },
      { status: 500 }
    )
  }
}
