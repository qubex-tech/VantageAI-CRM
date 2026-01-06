'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileText, Edit2, Trash2, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

const NOTE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'medical', label: 'Medical' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'billing', label: 'Billing' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'medication', label: 'Medication' },
  { value: 'allergy', label: 'Allergy' },
  { value: 'contact', label: 'Contact' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
] as const

interface PatientNote {
  id: string
  type: string
  content: string
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    name: string
    email: string
  }
}

interface PatientNotesProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  onNoteChange?: () => void
}

export function PatientNotes({
  open,
  onOpenChange,
  patientId,
  onNoteChange,
}: PatientNotesProps) {
  const [notes, setNotes] = useState<PatientNote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingNote, setEditingNote] = useState<PatientNote | null>(null)
  const [formType, setFormType] = useState<string>('general')
  const [formContent, setFormContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Fetch notes when dialog opens
  useEffect(() => {
    if (open && patientId) {
      fetchNotes()
    }
  }, [open, patientId])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setEditingNote(null)
        setFormType('general')
        setFormContent('')
        setError('')
        setDeleteConfirm(null)
      }, 300)
    }
  }, [open])

  const fetchNotes = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/patients/${patientId}/notes`)
      if (!response.ok) {
        throw new Error('Failed to fetch notes')
      }
      const data = await response.json()
      setNotes(data.notes || [])
    } catch (err) {
      console.error('Error fetching notes:', err)
      setError('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const url = editingNote
        ? `/api/patients/${patientId}/notes/${editingNote.id}`
        : `/api/patients/${patientId}/notes`
      
      const method = editingNote ? 'PATCH' : 'POST'
      const body = { type: formType, content: formContent.trim() }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save note')
      }

      // Reset form and refresh notes
      setEditingNote(null)
      setFormType('general')
      setFormContent('')
      await fetchNotes()
      onNoteChange?.()
    } catch (err) {
      console.error('Error saving note:', err)
      setError(err instanceof Error ? err.message : 'Failed to save note')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (note: PatientNote) => {
    setEditingNote(note)
    setFormType(note.type)
    setFormContent(note.content)
    setError('')
  }

  const handleDelete = async (noteId: string) => {
    setError('')
    setSubmitting(true)
    try {
      const response = await fetch(`/api/patients/${patientId}/notes/${noteId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete note')
      }

      setDeleteConfirm(null)
      await fetchNotes()
      onNoteChange?.()
    } catch (err) {
      console.error('Error deleting note:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete note')
    } finally {
      setSubmitting(false)
    }
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      medical: 'bg-red-100 text-red-800',
      administrative: 'bg-blue-100 text-blue-800',
      billing: 'bg-yellow-100 text-yellow-800',
      appointment: 'bg-purple-100 text-purple-800',
      medication: 'bg-green-100 text-green-800',
      allergy: 'bg-orange-100 text-orange-800',
      contact: 'bg-cyan-100 text-cyan-800',
      insurance: 'bg-indigo-100 text-indigo-800',
      general: 'bg-gray-100 text-gray-800',
      other: 'bg-gray-100 text-gray-800',
    }
    return colors[type] || colors.other
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Patient Notes
          </DialogTitle>
          <DialogDescription>
            Add, edit, and manage notes for this patient
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-800 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Notes list */}
          <div className="space-y-4 mb-6">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading notes...</div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No notes yet. Add your first note below.
              </div>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="border border-gray-200 rounded-lg p-4 bg-white"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(note.type)}`}
                      >
                        {NOTE_TYPES.find((t) => t.value === note.type)?.label || note.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    {deleteConfirm === note.id ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(note.id)}
                          disabled={submitting}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteConfirm(null)}
                          disabled={submitting}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(note)}
                          disabled={submitting || editingNote !== null}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteConfirm(note.id)}
                          disabled={submitting || editingNote !== null}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap mb-2">
                    {note.content}
                  </p>
                  <p className="text-xs text-gray-500">
                    By {note.user.name}
                    {new Date(note.updatedAt).getTime() !== new Date(note.createdAt).getTime() && (
                      <span> • Edited {format(new Date(note.updatedAt), 'MMM d, yyyy h:mm a')}</span>
                    )}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Add/Edit form */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-4">
              {editingNote ? 'Edit Note' : 'Add New Note'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="note-type">Note Type</Label>
                <Select
                  value={formType}
                  onValueChange={setFormType}
                  disabled={submitting}
                >
                  <SelectTrigger id="note-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="note-content">Content</Label>
                <Textarea
                  id="note-content"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Enter note content..."
                  rows={4}
                  disabled={submitting}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={submitting || !formContent.trim()}>
                  {submitting ? 'Saving...' : editingNote ? 'Update Note' : 'Add Note'}
                </Button>
                {editingNote && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingNote(null)
                      setFormType('general')
                      setFormContent('')
                      setError('')
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

