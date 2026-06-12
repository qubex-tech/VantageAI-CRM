import { redirect } from 'next/navigation'
import { requirePracticeUser } from '@/lib/auth-server'
import { prisma } from '@/lib/db'
import { TaskForm } from '@/components/tasks/TaskForm'

export const dynamic = 'force-dynamic'

export default async function NewTaskPage() {
    const user = await requirePracticeUser()


  const practiceId = user.practiceId

  // Get users for assignment dropdown
  const users = await prisma.user.findMany({
    where: {
      practiceId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Create New Task</h1>
        <p className="text-sm text-gray-500">Add a new task to track work and follow-ups</p>
      </div>

      <TaskForm users={users} currentUserId={user.id} />
    </div>
  )
}
