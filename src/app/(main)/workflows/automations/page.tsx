import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { AutomationsPage } from '@/components/settings/AutomationsPage'

export const dynamic = 'force-dynamic'

export default async function WorkflowAutomationsPage() {
  const supabaseSession = await getSupabaseSession()
  
  if (!supabaseSession) {
    redirect('/login')
  }

  const supabaseUser = supabaseSession.user
  let user
  try {
    user = await syncSupabaseUserToPrisma(supabaseUser)
  } catch (error) {
    console.error('Error syncing user to Prisma:', error)
    redirect('/login')
  }
  
  if (!user || !user.practiceId) {
    redirect('/login?error=Practice access required')
  }

  type SerializedRule = {
    id: string
    practiceId: string
    name: string
    enabled: boolean
    triggerEvent: string
    conditionsJson: any
    actionsJson: any[]
    createdByUserId: string
    createdAt: string
    updatedAt: string
    _count?: {
      runs: number
    }
    runStats?: {
      succeeded: number
      failed: number
      running: number
      averageDurationMs: number | null
    }
  }

  let rules: SerializedRule[] = []
  try {
    const rulesData = await prisma.automationRule.findMany({
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

    // Serialize dates to strings for client component
    rules = rulesData.map((rule) => {
      const stats = runStatsByRule[rule.id]
      return {
        id: rule.id,
        practiceId: rule.practiceId,
        name: rule.name,
        enabled: rule.enabled,
        triggerEvent: rule.triggerEvent,
        conditionsJson: rule.conditionsJson as any,
        actionsJson: (Array.isArray(rule.actionsJson) ? rule.actionsJson : []) as any[],
        createdByUserId: rule.createdByUserId,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
        _count: rule._count,
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
  } catch (error: any) {
    console.error('Error fetching automation rules:', error)
    // If the error is about automationRule not existing, it means Prisma client needs restart
    if (error?.message?.includes('automationRule') || error?.message?.includes('Cannot read')) {
      console.error('⚠️  Prisma client does not have automationRule model.')
      console.error('⚠️  Please RESTART your dev server (stop with Ctrl+C, then run: npm run dev)')
    }
    // Return empty array - page will still render but show no rules
    rules = []
  }

  return <AutomationsPage initialRules={rules} practiceId={user.practiceId} userId={user.id} />
}

