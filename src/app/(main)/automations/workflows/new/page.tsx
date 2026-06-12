import { redirect } from 'next/navigation'
import { requireAuthenticatedUser } from '@/lib/auth-server'
import { WorkflowEditor } from '@/components/workflows/WorkflowEditor'

export const dynamic = 'force-dynamic'

export default async function NewWorkflowPage() {
  const user = await requireAuthenticatedUser()

  // Practice-specific feature - require practiceId
  if (!user.practiceId) {
    redirect('/automations/workflows')
  }
  const practiceId = user.practiceId

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Create Workflow</h1>
        <p className="text-sm text-gray-500">Build automations to streamline your practice</p>
      </div>
      <WorkflowEditor practiceId={practiceId} />
    </div>
  )
}

