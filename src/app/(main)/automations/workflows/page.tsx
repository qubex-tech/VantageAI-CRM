import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { WorkflowsTable } from '@/components/workflows/WorkflowsTable'

export const dynamic = 'force-dynamic'

export default async function WorkflowsPage() {
  try {
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const safeErrorMessage = errorMessage.length > 100 
        ? errorMessage.substring(0, 100) + '...'
        : errorMessage
      redirect(`/login?error=${encodeURIComponent(`Failed to sync user account: ${safeErrorMessage}`)}`)
    }
    
    if (!user) {
      redirect('/login?error=User account not found.')
    }

    // Fetch workflows from database with runs data
    const workflows = await prisma.workflow.findMany({
    where: {
      practiceId: user.practiceId,
    },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
      _count: {
        select: {
          runs: true,
        },
      },
      runs: {
        where: {
          status: 'failed',
        },
        orderBy: {
          startedAt: 'desc',
        },
        take: 1,
        select: {
          startedAt: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  // Get creator names from audit logs for workflows
  const workflowIds = workflows.map(w => w.id)
  let auditLogs: Array<{ resourceId: string; user: { name: string } | null }> = []
  
  if (workflowIds.length > 0) {
    try {
      auditLogs = await prisma.auditLog.findMany({
        where: {
          practiceId: user.practiceId,
          resourceType: 'workflow',
          resourceId: { in: workflowIds },
          action: 'create',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
    } catch (error) {
      console.error('[WorkflowsPage] Error fetching audit logs:', error)
      // Continue without audit log data - not critical
    }
  }

  // Create a map of workflow ID to creator name
  const creatorMap = new Map<string, string>()
  auditLogs.forEach(log => {
    if (log.user) {
      creatorMap.set(log.resourceId, log.user.name)
    }
  })

  // Transform workflows to include the stats we need
  const workflowsWithStats = workflows.map((workflow) => {
    // Get last failed run date
    const lastFailedRun = workflow.runs.length > 0 ? workflow.runs[0].startedAt : null

    // Get creator name from audit logs, fallback to current user if not found
    const createdByName = creatorMap.get(workflow.id) || user.name

    // Safely access publishedAt - handle case where Prisma Client might not have it yet
    // Use type assertion to access the field safely
    const workflowAny = workflow as any
    const publishedAt: Date | null = workflowAny.publishedAt || null

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      isActive: workflow.isActive,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      publishedAt,
      runCount: workflow._count.runs,
      lastFailedRun,
      createdByName,
    }
  })

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Workflows</h1>
          <p className="text-sm text-gray-500">Create automations to streamline your practice</p>
        </div>
        <Link href="/automations/workflows/new">
          <Button className="bg-gray-900 hover:bg-gray-800 text-white font-medium">
            <Plus className="mr-2 h-4 w-4" />
            New workflow
          </Button>
        </Link>
      </div>

      <WorkflowsTable workflows={workflowsWithStats} />
    </div>
    )
  } catch (error) {
    console.error('[WorkflowsPage] Error:', error)
    // Return a more helpful error message
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error loading workflows</h2>
          <p className="text-sm text-red-700 mb-4">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <p className="text-xs text-red-600">
            Please check the server logs for more details. If the error persists, ensure the database migration has been run.
          </p>
        </div>
      </div>
    )
  }
}

