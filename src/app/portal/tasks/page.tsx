import { redirect } from 'next/navigation'
import { getPatientSession } from '@/lib/portal-session'
import { prisma } from '@/lib/db'
import { BackButton } from '@/components/portal/BackButton'

export const dynamic = 'force-dynamic'

export default async function PortalTasksPage() {
  const session = await getPatientSession()

  if (!session) {
    redirect('/portal/auth')
  }

  const tasks = await prisma.patientTask.findMany({
    where: {
      practiceId: session.practiceId,
      patientId: session.patientId,
    },
    orderBy: [
      { status: 'asc' },
      { dueDate: 'asc' },
      { createdAt: 'desc' },
    ],
  })

  const pendingTasks = tasks.filter((task) => task.status !== 'completed')
  const completedTasks = tasks.filter((task) => task.status === 'completed')

  const formatDate = (value?: Date | null) =>
    value ? new Date(value).toLocaleDateString() : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-2">
            Review items that need your attention and your completed forms.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Pending</h2>
              <span className="text-sm text-gray-500">{pendingTasks.length} open</span>
            </div>
            {pendingTasks.length === 0 ? (
              <p className="text-gray-500">No pending tasks.</p>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map((task) => (
                  <div key={task.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900">{task.title}</p>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                        )}
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {task.dueDate && <div>Due {formatDate(task.dueDate)}</div>}
                        <div className="capitalize">{task.status.replace('_', ' ')}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Completed</h2>
              <span className="text-sm text-gray-500">{completedTasks.length} done</span>
            </div>
            {completedTasks.length === 0 ? (
              <p className="text-gray-500">No completed tasks yet.</p>
            ) : (
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <div key={task.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900">{task.title}</p>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                        )}
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {task.completedAt && <div>Completed {formatDate(task.completedAt)}</div>}
                        <div className="capitalize">Completed</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
