'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, User, Users, CheckSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CreateTaskModalProps {
  open: boolean
  onClose: () => void
  users: Array<{ id: string; name: string; email: string }>
  patients?: Array<{ id: string; name: string; email: string | null; primaryPhone: string | null; phone: string }>
  currentUserId: string
  defaultPatientId?: string
  onCreateSuccess?: () => void
}

export function CreateTaskModal({
  open,
  onClose,
  users,
  patients = [],
  currentUserId,
  defaultPatientId,
  onCreateSuccess,
}: CreateTaskModalProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [assignedTo, setAssignedTo] = useState<string>('')
  const [patientId, setPatientId] = useState<string>(defaultPatientId || '')
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 })
  const [createMore, setCreateMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const mentionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (defaultPatientId) {
      setPatientId(defaultPatientId)
    }
  }, [defaultPatientId])

  useEffect(() => {
    if (open) {
      setTitle('')
      setAssignedTo('')
      setPatientId(defaultPatientId || '')
      setCreateMore(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, defaultPatientId])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setTitle(value)

    // Check for @mention
    const cursorPos = e.target.selectionStart || 0
    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const query = textBeforeCursor.substring(lastAtIndex + 1)
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionQuery(query)
        setMentionPosition({ start: lastAtIndex, end: cursorPos })
        setShowMentionDropdown(true)
        return
      }
    }

    setShowMentionDropdown(false)
  }

  const handleMentionSelect = (type: 'user' | 'patient', id: string, name: string) => {
    const beforeMention = title.substring(0, mentionPosition.start)
    const afterMention = title.substring(mentionPosition.end)
    const newTitle = `${beforeMention}@${name}${afterMention}`

    setTitle(newTitle)
    setShowMentionDropdown(false)

    if (type === 'user') {
      setAssignedTo(id)
    } else {
      setPatientId(id)
    }

    setTimeout(() => {
      inputRef.current?.focus()
      const newCursorPos = mentionPosition.start + name.length + 1
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  const filteredPatients = patients.filter(
    (patient) =>
      patient.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      patient.email?.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      patient.primaryPhone?.includes(mentionQuery) ||
      patient.phone?.includes(mentionQuery)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          assignedTo: assignedTo || null,
          patientId: patientId || null,
          status: 'pending',
        }),
      })

      if (response.ok) {
        if (createMore) {
          setTitle('')
          setAssignedTo('')
          setPatientId(defaultPatientId || '')
          inputRef.current?.focus()
        } else {
          onClose()
          if (onCreateSuccess) {
            onCreateSuccess()
          } else {
            router.refresh()
          }
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create task')
      }
    } catch (error) {
      console.error('Error creating task:', error)
      alert('Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Create Task</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="relative">
            <Input
              ref={inputRef}
              value={title}
              onChange={handleTitleChange}
              onBlur={() => setTimeout(() => setShowMentionDropdown(false), 200)}
              placeholder="Type task title... Use @ to mention users or link records"
              className="w-full"
              autoFocus
            />
            {showMentionDropdown && (filteredUsers.length > 0 || filteredPatients.length > 0) && (
              <div
                ref={mentionRef}
                className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto"
              >
                {filteredUsers.length > 0 && (
                  <div className="p-2">
                    <div className="text-xs font-medium text-gray-500 px-2 py-1">Users</div>
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleMentionSelect('user', user.id, user.name)}
                        className="w-full flex items-center gap-2 px-2 py-2 hover:bg-gray-100 rounded text-left"
                      >
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-500 truncate">{user.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {filteredPatients.length > 0 && (
                  <div className="p-2 border-t border-gray-200">
                    <div className="text-xs font-medium text-gray-500 px-2 py-1">Records</div>
                    {filteredPatients.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => handleMentionSelect('patient', patient.id, patient.name)}
                        className="w-full flex items-center gap-2 px-2 py-2 hover:bg-gray-100 rounded text-left"
                      >
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                          {patient.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {patient.email || patient.primaryPhone || patient.phone || ''}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">To</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={createMore}
                onChange={(e) => setCreateMore(e.target.checked)}
                className="h-4 w-4"
              />
              Create more
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
                <span className="ml-2 text-xs text-gray-500">ESC</span>
              </Button>
              <Button
                type="submit"
                disabled={loading || !title.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
