'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format, isPast, isToday, isTomorrow, startOfDay } from 'date-fns'
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle, 
  User, 
  Calendar,
  Filter,
  Search,
  Settings,
  Plus,
  ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CreateTaskModal } from './CreateTaskModal'

interface TasksListProps {
  initialTasks: any[]
  currentUserId: string
  users: Array<{ id: string; name: string; email: string }>
  patients?: Array<{ id: string; name: string; email: string | null; primaryPhone: string | null; phone: string }>
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
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
  if (isTomorrow(date)) {
    return { label: 'Due tomorrow', color: 'text-yellow-600' }
  }
  return { label: format(date, 'MMM d, yyyy'), color: 'text-gray-600' }
}

function groupTasksByDate(tasks: any[]) {
  const today = startOfDay(new Date())
  const groups: Record<string, any[]> = {
    'Overdue': [],
    'Today': [],
    'Tomorrow': [],
    'Upcoming': [],
    'No due date': [],
  }

  tasks.forEach((task) => {
    if (task.status === 'completed') {
      // Completed tasks can go to their date group or "Upcoming"
      if (!task.dueDate) {
        groups['No due date'].push(task)
      } else {
        const dueDate = startOfDay(new Date(task.dueDate))
        const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (daysDiff < 0) {
          groups['Overdue'].push(task)
        } else if (daysDiff === 0) {
          groups['Today'].push(task)
        } else if (daysDiff === 1) {
          groups['Tomorrow'].push(task)
        } else {
          groups['Upcoming'].push(task)
        }
      }
    } else {
      if (!task.dueDate) {
        groups['No due date'].push(task)
      } else {
        const dueDate = startOfDay(new Date(task.dueDate))
        const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (daysDiff < 0) {
          groups['Overdue'].push(task)
        } else if (daysDiff === 0) {
          groups['Today'].push(task)
        } else if (daysDiff === 1) {
          groups['Tomorrow'].push(task)
        } else {
          groups['Upcoming'].push(task)
        }
      }
    }
  })

  // Remove empty groups and return as array
  return Object.entries(groups).filter(([_, tasks]) => tasks.length > 0)
}

export function TasksList({ initialTasks, currentUserId, users, patients = [] }: TasksListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tasks, setTasks] = useState(initialTasks)
  const [search, setSearch] = useState(searchParams?.get('search') || '')
  const [sortBy, setSortBy] = useState(searchParams?.get('sortBy') || 'dueDate')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const updateURL = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() || '')
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    router.push(`/tasks?${params.toString()}`)
  }

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
    router.refresh()
  }

  // Filter tasks by search
  const filteredTasks = tasks.filter((task) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      task.title.toLowerCase().includes(searchLower) ||
      task.description?.toLowerCase().includes(searchLower) ||
      task.patient?.name.toLowerCase().includes(searchLower) ||
      task.assignee?.name.toLowerCase().includes(searchLower)
    )
  })

  // Group tasks by date
  const groupedTasks = groupTasksByDate(filteredTasks)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
          <Select value={sortBy} onValueChange={(value) => {
            setSortBy(value)
            updateURL({ sortBy: value })
          }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dueDate">Sorted by Due date</SelectItem>
              <SelectItem value="priority">Sorted by Priority</SelectItem>
              <SelectItem value="createdAt">Sorted by Created</SelectItem>
              <SelectItem value="status">Sorted by Status</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            View settings
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            New task
          </Button>
        </div>
      </div>

      {/* Tasks Table */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <div className="max-w-md mx-auto">
            <div className="mb-4">
              <svg className="w-24 h-24 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-900 mb-2">No tasks yet!</p>
            <p className="text-sm text-gray-500 mb-6">Create your first task to get started.</p>
            <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              New task
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input type="checkbox" className="h-4 w-4" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Task
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Record
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    @ Assigned to
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groupedTasks.map(([groupName, groupTasks]) => (
                  <>
                    <tr key={`group-${groupName}`} className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-700">{groupName}</span>
                          <span className="text-xs text-gray-500">({groupTasks.length})</span>
                        </div>
                      </td>
                    </tr>
                    {groupTasks.map((task) => {
                      const dueDateInfo = getDueDateLabel(task.dueDate)
                      const isCompleted = task.status === 'completed'
                      
                      return (
                        <tr
                          key={task.id}
                          className={`hover:bg-gray-50 transition-colors ${isCompleted ? 'opacity-60' : ''}`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={isCompleted}
                              onChange={() => {
                                const newStatus = isCompleted ? 'pending' : 'completed'
                                handleTaskStatusChange(task.id, newStatus)
                              }}
                              className="h-4 w-4"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/tasks/${task.id}`} className="flex items-center gap-2 group">
                              <div className="flex-shrink-0">
                                {getStatusIcon(task.status)}
                              </div>
                              <span className={`text-sm ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900 group-hover:text-gray-700'}`}>
                                {task.title}
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-sm ${dueDateInfo.color}`}>
                              {dueDateInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {task.patient ? (
                              <Link
                                href={`/patients/${task.patient.id}`}
                                className="flex items-center gap-2 text-sm text-gray-900 hover:text-blue-600"
                              >
                                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                  {getInitials(task.patient.name)}
                                </div>
                                <span>{task.patient.name}</span>
                              </Link>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {task.assignee ? (
                              <div className="flex items-center gap-2 text-sm text-gray-900">
                                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                  {getInitials(task.assignee.name)}
                                </div>
                                <span>{task.assignee.name}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">Unassigned</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateTaskModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        users={users}
        patients={patients}
        currentUserId={currentUserId}
        onCreateSuccess={handleCreateSuccess}
      />
    </div>
  )
}
