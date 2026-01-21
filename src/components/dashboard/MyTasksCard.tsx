'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'

interface MyTasksCardProps {
  tasks: any[]
  users: Array<{ id: string; name: string; email: string }>
  patients?: Array<{ id: string; name: string; email: string | null; primaryPhone: string | null; phone: string }>
  currentUserId: string
}

export function MyTasksCard({ tasks, users, patients = [], currentUserId }: MyTasksCardProps) {
  const router = useRouter()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const handleCreateSuccess = () => {
    router.refresh()
  }

  const pendingTasks = tasks.filter(task => task.status !== 'completed')

  return (
    <>
      <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-900">My Tasks</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            {pendingTasks.length} pending task{pendingTasks.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No pending tasks</p>
            ) : (
              pendingTasks.slice(0, 5).map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="block py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {task.patient && (
                          <p className="text-xs text-gray-500 truncate">{task.patient.name}</p>
                        )}
                        {task.dueDate && (
                          <span className="text-xs text-gray-400">
                            • {format(new Date(task.dueDate), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                      task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                      task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              className="flex-1 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              onClick={() => setShowCreateModal(true)}
            >
              + New Task
            </Button>
            <Link href="/tasks" className="flex-1">
              <Button variant="ghost" className="w-full text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                View All →
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <CreateTaskModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        users={users}
        patients={patients}
        currentUserId={currentUserId}
        onCreateSuccess={handleCreateSuccess}
      />
    </>
  )
}
