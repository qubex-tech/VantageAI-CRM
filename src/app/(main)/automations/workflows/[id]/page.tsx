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

  // Practice-specific feature - require practiceId
  if (!user.practiceId) {
    notFound()
  }
  const practiceId = user.practiceId

  // Fetch workflow - use raw query workaround if Prisma Client is out of sync
  let workflow
  try {
    workflow = await prisma.workflow.findFirst({
      where: {
        id,
        practiceId: practiceId,
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })
  } catch (error: any) {
    // If error is about publishedAt, use raw query workaround
    if (error?.message?.includes('publishedAt') || error?.message?.includes('published_at')) {
      console.error('[EditWorkflowPage] Prisma Client sync issue - using raw query workaround:', error.message)
      
      // Use raw SQL query as fallback
      const rawWorkflows = await prisma.$queryRaw<Array<{
        id: string
        practiceId: string
        name: string
        description: string | null
        isActive: boolean
        triggerType: string | null
        triggerConfig: any
        publishedAt: Date | null
        createdAt: Date
        updatedAt: Date
      }>>`
        SELECT 
          id, "practiceId", name, description, "isActive", "triggerType", "triggerConfig",
          "published_at" as "publishedAt", "createdAt", "updatedAt"
        FROM workflows
        WHERE id = ${id} AND "practiceId" = ${practiceId}
        LIMIT 1
      `
      
      if (rawWorkflows.length === 0) {
        notFound()
      }
      
      const rawWorkflow = rawWorkflows[0]
      
      // Fetch steps separately
      const steps = await prisma.workflowStep.findMany({
        where: { workflowId: rawWorkflow.id },
        orderBy: { order: 'asc' },
      })
      
      // Reconstruct workflow object to match Prisma structure
      workflow = {
        id: rawWorkflow.id,
        practiceId: rawWorkflow.practiceId,
        name: rawWorkflow.name,
        description: rawWorkflow.description,
        isActive: rawWorkflow.isActive,
        triggerType: rawWorkflow.triggerType,
        triggerConfig: rawWorkflow.triggerConfig,
        publishedAt: rawWorkflow.publishedAt,
        createdAt: rawWorkflow.createdAt,
        updatedAt: rawWorkflow.updatedAt,
        steps,
      } as any
    } else {
      throw error
    }
  }

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
        practiceId={practiceId} 
        workflowId={workflow.id}
        initialWorkflow={workflow}
      />
    </div>
  )
}

