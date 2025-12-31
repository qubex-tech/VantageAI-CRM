import { redirect, notFound } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { WorkflowEditor } from '@/components/workflows/WorkflowEditor'

export const dynamic = 'force-dynamic'

export default async function EditWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const workflow = await prisma.workflow.findFirst({
    where: {
      id,
      practiceId: user.practiceId,
    },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!workflow) {
    notFound()
  }

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Edit Workflow</h1>
        <p className="text-sm text-gray-500">Build automations to streamline your practice</p>
      </div>
      <WorkflowEditor 
        practiceId={user.practiceId} 
        workflowId={workflow.id}
        initialWorkflow={workflow}
      />
    </div>
  )
}

