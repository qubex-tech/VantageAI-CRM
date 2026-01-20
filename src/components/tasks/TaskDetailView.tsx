'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle, 
  User, 
  Calendar,
  Edit,
  Trash2,
  MessageSquare,
  ArrowLeft
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TaskForm } from './TaskForm'
import { TaskComments } from './TaskComments'

interface TaskDetailViewProps {
  task: any
  users: Array<{ id: string; name: string; email: string }>
  currentUserId: string
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'low':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-600" />
    case 'in_progress':
      return <Clock className="h-5 w-5 text-blue-600" />
    case 'on_hold':
      return <AlertCircle className="h-5 w-5 text-yellow-600" />
    case 'cancelled':
      return <Circle className="h-5 w-5 text-gray-400" />
    default:
      return <Circle className="h-5 w-5 text-gray-400" />
  }
}

export function TaskDetailView({ task: initialTask, users, currentUserId }: TaskDetailViewProps) {
  const router = useRouter()
  const [task, setTask] = useState(initialTask)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.push('/tasks')
        router.refresh()
      } else {
        alert('Failed to delete task')
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        const { task: updatedTask } = await response.json()
        setTask(updatedTask)
      }
    } catch (error) {
      console.error('Error updating task status:', error)
    }
  }

  if (isEditing) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setIsEditing(false)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Task
        </Button>
        <TaskForm
          task={task}
          users={users}
          currentUserId={currentUserId}
          onSuccess={() => {
            setIsEditing(false)
            router.refresh()
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/tasks">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tasks
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleDelete} disabled={isDeleting}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <button
                onClick={() => {
                  const newStatus = task.status === 'completed' ? 'pending' : 'completed'
                  handleStatusChange(newStatus)
                }}
                className="mt-1"
              >
                {getStatusIcon(task.status)}
              </button>
              <div className="flex-1">
                <CardTitle className="text-xl">{task.title}</CardTitle>
                {task.description && (
                  <p className="text-sm text-gray-600 mt-2">{task.description}</p>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500">Status</label>
              <div className="mt-1">
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500">Priority</label>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500">Category</label>
              <p className="text-sm text-gray-900 mt-1 capitalize">{task.category.replace('_', ' ')}</p>
            </div>

            {task.dueDate && (
              <div>
                <label className="text-xs font-medium text-gray-500">Due Date</label>
                <p className="text-sm text-gray-900 mt-1 flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(task.dueDate), 'MMM d, yyyy')}
                </p>
              </div>
            )}

            {task.assignee && (
              <div>
                <label className="text-xs font-medium text-gray-500">Assigned To</label>
                <p className="text-sm text-gray-900 mt-1 flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {task.assignee.name}
                </p>
              </div>
            )}

            {task.patient && (
              <div>
                <label className="text-xs font-medium text-gray-500">Patient</label>
                <Link href={`/patients/${task.patient.id}`} className="text-sm text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {task.patient.name}
                </Link>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-500">Created By</label>
              <p className="text-sm text-gray-900 mt-1">{task.creator.name}</p>
            </div>

            {task.completedAt && (
              <div>
                <label className="text-xs font-medium text-gray-500">Completed At</label>
                <p className="text-sm text-gray-900 mt-1">
                  {format(new Date(task.completedAt), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <TaskComments taskId={task.id} comments={task.comments} />
    </div>
  )
}
