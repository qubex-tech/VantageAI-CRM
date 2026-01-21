import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { z } from 'zod'

const automationRuleSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  triggerEvent: z.string().min(1),
  conditionsJson: z.any(), // JSON structure
  actionsJson: z.array(z.object({
    type: z.string(),
    args: z.record(z.any()),
  })),
})

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const rules = await prisma.automationRule.findMany({
      where: {
        practiceId: user.practiceId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            runs: true,
          },
        },
      },
    })

    const runs = await prisma.automationRun.findMany({
      where: {
        practiceId: user.practiceId,
      },
      select: {
        ruleId: true,
        status: true,
        startedAt: true,
        finishedAt: true,
      },
    })

    const runStatsByRule: Record<string, {
      succeeded: number
      failed: number
      running: number
      averageDurationMs: number | null
      durationCount: number
      durationTotalMs: number
    }> = {}

    for (const run of runs) {
      if (!runStatsByRule[run.ruleId]) {
        runStatsByRule[run.ruleId] = {
          succeeded: 0,
          failed: 0,
          running: 0,
          averageDurationMs: null,
          durationCount: 0,
          durationTotalMs: 0,
        }
      }

      const stats = runStatsByRule[run.ruleId]

      if (run.status === 'succeeded') {
        stats.succeeded += 1
      } else if (run.status === 'failed') {
        stats.failed += 1
      } else if (run.status === 'running') {
        stats.running += 1
      }

      if (run.finishedAt) {
        const durationMs = run.finishedAt.getTime() - run.startedAt.getTime()
        if (durationMs >= 0) {
          stats.durationTotalMs += durationMs
          stats.durationCount += 1
        }
      }
    }

    const rulesWithStats = rules.map((rule) => {
      const stats = runStatsByRule[rule.id]
      return {
        ...rule,
        runStats: stats
          ? {
              succeeded: stats.succeeded,
              failed: stats.failed,
              running: stats.running,
              averageDurationMs: stats.durationCount > 0
                ? Math.round(stats.durationTotalMs / stats.durationCount)
                : null,
            }
          : {
              succeeded: 0,
              failed: 0,
              running: 0,
              averageDurationMs: null,
            },
      }
    })

    return NextResponse.json({ rules: rulesWithStats })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch rules' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validated = automationRuleSchema.parse(body)

    const rule = await prisma.automationRule.create({
      data: {
        practiceId: user.practiceId,
        name: validated.name,
        enabled: validated.enabled,
        triggerEvent: validated.triggerEvent,
        conditionsJson: validated.conditionsJson,
        actionsJson: validated.actionsJson,
        createdByUserId: user.id,
      },
    })

    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create rule' },
      { status: 500 }
    )
  }
}

