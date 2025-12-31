import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { WorkflowsList } from '@/components/workflows/WorkflowsList'

export const dynamic = 'force-dynamic'

export default async function WorkflowsPage() {
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

  // Fetch workflows from database
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
    },
    orderBy: {
      updatedAt: 'desc',
    },
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
            Create Workflow
          </Button>
        </Link>
      </div>

      <WorkflowsList initialWorkflows={workflows} />
    </div>
  )
}

