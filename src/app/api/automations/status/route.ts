import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'

/**
 * Diagnostic endpoint to check automation system status
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const practiceId = user.practiceId

    // Get outbox event stats
    const outboxStats = {
      pending: await prisma.outboxEvent.count({
        where: { practiceId, status: 'pending' },
      }),
      published: await prisma.outboxEvent.count({
        where: { practiceId, status: 'published' },
      }),
      failed: await prisma.outboxEvent.count({
        where: { practiceId, status: 'failed' },
      }),
      recentPending: await prisma.outboxEvent.findMany({
        where: { practiceId, status: 'pending' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          createdAt: true,
          attempts: true,
          nextAttemptAt: true,
        },
      }),
    }

    // Get automation rule stats
    const ruleStats = {
      total: await prisma.automationRule.count({
        where: { practiceId },
      }),
      enabled: await prisma.automationRule.count({
        where: { practiceId, enabled: true },
      }),
    }

    // Get automation run stats
    const runStats = {
      total: await prisma.automationRun.count({
        where: { practiceId },
      }),
      running: await prisma.automationRun.count({
        where: { practiceId, status: 'running' },
      }),
      succeeded: await prisma.automationRun.count({
        where: { practiceId, status: 'succeeded' },
      }),
      failed: await prisma.automationRun.count({
        where: { practiceId, status: 'failed' },
      }),
      recent: await prisma.automationRun.findMany({
        where: { practiceId },
        take: 5,
        orderBy: { startedAt: 'desc' },
        include: {
          rule: {
            select: {
              name: true,
            },
          },
        },
      }).then(runs => runs.map(run => ({
        id: run.id,
        ruleId: run.ruleId,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        error: run.error,
        rule: run.rule,
      }))),
    }

    // Check Inngest configuration
    const inngestConfig = {
      eventKey: process.env.INNGEST_EVENT_KEY ? 'Set' : 'Missing',
      signingKey: process.env.INNGEST_SIGNING_KEY ? 'Set' : 'Optional',
      nodeEnv: process.env.NODE_ENV || 'not set',
    }

    return NextResponse.json({
      status: 'ok',
      practiceId,
      outbox: outboxStats,
      rules: ruleStats,
      runs: runStats,
      inngest: inngestConfig,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to get status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

