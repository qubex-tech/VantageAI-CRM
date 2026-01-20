'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, isPast, isToday } from 'date-fns'
import { CheckSquare, Plus, Circle, Clock, AlertCircle, CheckCircle2, User, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateTaskModal } from './CreateTaskModal'

interface PatientTasksProps {
  patientId: string
  users: Array<{ id: string; name: string; email: string }>
  currentUserId: string
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />
    case 'in_progress':
      return <Clock className="h-4 w-4 text-blue-600" />
    case 'on_hold':
      return <AlertCircle className="h-4 w-4 text-yellow-600" />
    case 'cancelled':
      return <Circle className="h-4 w-4 text-gray-400" />
    default:
      return <Circle className="h-4 w-4 text-gray-400" />
  }
}

function getDueDateLabel(dueDate: Date | null | undefined): { label: string; color: string } {
  if (!dueDate) {
    return { label: 'No due date', color: 'text-gray-500' }
  }

  const date = new Date(dueDate)
  if (isPast(date) && !isToday(date)) {
    return { label: `Overdue: ${format(date, 'MMM d')}`, color: 'text-red-600 font-medium' }
  }
  if (isToday(date)) {
    return { label: 'Due today', color: 'text-orange-600 font-medium' }
  }
  return { label: format(date, 'MMM d, yyyy'), color: 'text-gray-600' }
}

export function PatientTasks({ patientId, users, currentUserId }: PatientTasksProps) {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch(`/api/tasks?patientId=${patientId}&limit=10`)
        if (response.ok) {
          const data = await response.json()
          setTasks(data.tasks || [])
        }
      } catch (error) {
        console.error('Error fetching tasks:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [patientId])

  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        const { task } = await response.json()
        setTasks(tasks.map(t => t.id === taskId ? task : t))
      }
    } catch (error) {
      console.error('Error updating task status:', error)
    }
  }

  const handleCreateSuccess = () => {
    // Refresh tasks
    const fetchTasks = async () => {
      try {
        const response = await fetch(`/api/tasks?patientId=${patientId}&limit=10`)
        if (response.ok) {
          const data = await response.json()
          setTasks(data.tasks || [])
        }
      } catch (error) {
        console.error('Error fetching tasks:', error)
      }
    }
    fetchTasks()
  }

  const pendingTasks = tasks.filter(t => t.status !== 'completed')
  const completedTasks = tasks.filter(t => t.status === 'completed')

  return (
    <>
      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-gray-500 py-2">Loading tasks...</div>
        ) : pendingTasks.length > 0 ? (
          <>
            {pendingTasks.slice(0, 5).map((task) => {
              const dueDateInfo = getDueDateLabel(task.dueDate)
              const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'completed'
              
              return (
                <div
                  key={task.id}
                  className={`border rounded-md p-3 bg-white hover:shadow-sm transition-shadow ${
                    isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => {
                        const newStatus = task.status === 'completed' ? 'pending' : 'completed'
                        handleTaskStatusChange(task.id, newStatus)
                      }}
                      className="mt-0.5 flex-shrink-0"
                    >
                      {getStatusIcon(task.status)}
                    </button>
                    <div className="flex-1 min-w-0">
                      <Link href={`/tasks/${task.id}`}>
                        <h4 className="text-sm font-medium text-gray-900 hover:text-gray-700">
                          {task.title}
                        </h4>
                      </Link>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {task.dueDate && (
                          <div className={`flex items-center gap-1 text-xs ${dueDateInfo.color}`}>
                            <Calendar className="h-3 w-3" />
                            {dueDateInfo.label}
                          </div>
                        )}
                        {task.assignee && (
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <User className="h-3 w-3" />
                            {task.assignee.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {pendingTasks.length > 5 && (
              <div className="text-xs text-gray-500 text-center pt-1">
                +{pendingTasks.length - 5} more task{pendingTasks.length - 5 !== 1 ? 's' : ''}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-500 italic py-2">
            No pending tasks for this patient.
          </div>
        )}

        {completedTasks.length > 0 && (
          <div className="pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-2">Completed ({completedTasks.length})</div>
            {completedTasks.slice(0, 2).map((task) => (
              <div key={task.id} className="border border-gray-200 rounded-md p-2 bg-gray-50 mb-2 opacity-75">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                  <Link href={`/tasks/${task.id}`}>
                    <span className="text-xs text-gray-600 line-through hover:text-gray-800">
                      {task.title}
                    </span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreateModal(true)}
          className="w-full mt-3"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </Button>

        {tasks.length > 0 && (
          <Link href={`/tasks?patientId=${patientId}`}>
            <Button variant="ghost" size="sm" className="w-full text-xs">
              View all tasks →
            </Button>
          </Link>
        )}
      </div>

      <CreateTaskModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        users={users}
        currentUserId={currentUserId}
        defaultPatientId={patientId}
        onCreateSuccess={handleCreateSuccess}
      />
    </>
  )
}
