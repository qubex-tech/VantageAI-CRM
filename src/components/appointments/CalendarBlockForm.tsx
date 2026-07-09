'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const WEEKDAYS = [
  { code: 'SU', label: 'Sun' },
  { code: 'MO', label: 'Mon' },
  { code: 'TU', label: 'Tue' },
  { code: 'WE', label: 'Wed' },
  { code: 'TH', label: 'Thu' },
  { code: 'FR', label: 'Fri' },
  { code: 'SA', label: 'Sat' },
] as const

export type CalendarBlockFormOccurrence = {
  blockId: string
  kind: 'block' | 'meeting'
  title: string
  notes: string | null
  startTime: Date | string
  endTime: Date | string
  timezone: string
  providerId: string | null
  isRecurring: boolean
  occurrenceDate: string
  series: {
    recurrenceFrequency: 'none' | 'daily' | 'weekly'
    recurrenceInterval: number
    recurrenceByDay: string[]
    recurrenceUntil: string | null
  }
}

type Practitioner = { id: string; reference: string; name: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  practitioners: Practitioner[]
  initial?: CalendarBlockFormOccurrence | null
  /** Prefill when creating from an empty slot click */
  defaultStart?: Date | null
  defaultEnd?: Date | null
  onSaved: () => void
}

function toLocalInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${hh}:${mm}`
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function CalendarBlockForm({
  open,
  onOpenChange,
  practitioners,
  initial,
  defaultStart,
  defaultEnd,
  onSaved,
}: Props) {
  const isEdit = Boolean(initial)
  const [title, setTitle] = useState('Blocked')
  const [kind, setKind] = useState<'block' | 'meeting'>('block')
  const [notes, setNotes] = useState('')
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  const [providerId, setProviderId] = useState<string>('all')
  const [frequency, setFrequency] = useState<'none' | 'daily' | 'weekly'>('none')
  const [byDay, setByDay] = useState<string[]>([])
  const [until, setUntil] = useState('')
  const [editScope, setEditScope] = useState<'series' | 'occurrence'>('series')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (initial) {
      const start = new Date(initial.startTime)
      const end = new Date(initial.endTime)
      setTitle(initial.title)
      setKind(initial.kind)
      setNotes(initial.notes || '')
      setStartLocal(toLocalInputValue(start))
      setEndLocal(toLocalInputValue(end))
      setProviderId(initial.providerId || 'all')
      setFrequency(initial.series.recurrenceFrequency)
      setByDay(initial.series.recurrenceByDay || [])
      setUntil(
        initial.series.recurrenceUntil
          ? toDateInputValue(new Date(initial.series.recurrenceUntil))
          : ''
      )
      setEditScope(initial.isRecurring ? 'occurrence' : 'series')
    } else {
      const start = defaultStart || new Date()
      const end = defaultEnd || new Date(start.getTime() + 60 * 60 * 1000)
      setTitle('Blocked')
      setKind('block')
      setNotes('')
      setStartLocal(toLocalInputValue(start))
      setEndLocal(toLocalInputValue(end))
      setProviderId('all')
      setFrequency('none')
      setByDay([])
      setUntil('')
      setEditScope('series')
    }
  }, [open, initial, defaultStart, defaultEnd])

  function toggleDay(code: string) {
    setByDay((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const startTime = new Date(startLocal)
      const endTime = new Date(endLocal)
      if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
        throw new Error('Invalid start or end time')
      }
      if (endTime <= startTime) {
        throw new Error('End time must be after start time')
      }

      const payload = {
        title: title.trim() || (kind === 'meeting' ? 'Meeting' : 'Blocked'),
        kind,
        notes: notes.trim() || null,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        providerId: providerId === 'all' ? null : providerId,
        recurrenceFrequency: editScope === 'occurrence' && isEdit ? 'none' : frequency,
        recurrenceInterval: 1,
        recurrenceByDay: frequency === 'weekly' ? byDay : [],
        recurrenceUntil: until ? new Date(`${until}T23:59:59`).toISOString() : null,
      }

      if (isEdit && initial) {
        const res = await fetch(`/api/calendar-blocks/${initial.blockId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            scope: initial.isRecurring ? editScope : 'series',
            occurrenceDate: initial.occurrenceDate,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update block')
      } else {
        const res = await fetch('/api/calendar-blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to create block')
      }

      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(scope: 'series' | 'occurrence') {
    if (!initial) return
    setDeleting(true)
    setError(null)
    try {
      const params = new URLSearchParams({ scope })
      if (scope === 'occurrence') {
        params.set('occurrenceDate', initial.occurrenceDate)
      }
      const res = await fetch(`/api/calendar-blocks/${initial.blockId}?${params}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit calendar block' : 'Block time'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isEdit && initial?.isRecurring && (
            <div className="space-y-1">
              <Label>Apply changes to</Label>
              <Select
                value={editScope}
                onValueChange={(v) => setEditScope(v as 'series' | 'occurrence')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="occurrence">This occurrence only</SelectItem>
                  <SelectItem value="series">Entire series</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="block-title">Title</Label>
            <Input
              id="block-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lunch, Meeting, Admin…"
            />
          </div>

          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as 'block' | 'meeting')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="block">Block (unavailable)</SelectItem>
                <SelectItem value="meeting">Meeting (unavailable)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="block-start">Start</Label>
              <Input
                id="block-start"
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="block-end">End</Label>
              <Input
                id="block-end"
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
              />
            </div>
          </div>

          {practitioners.length > 0 && (
            <div className="space-y-1">
              <Label>Provider</Label>
              <Select value={providerId} onValueChange={setProviderId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All practitioners</SelectItem>
                  {practitioners.map((p) => (
                    <SelectItem key={p.reference} value={p.reference}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(!isEdit || editScope === 'series') && (
            <>
              <div className="space-y-1">
                <Label>Repeats</Label>
                <Select
                  value={frequency}
                  onValueChange={(v) => setFrequency(v as 'none' | 'daily' | 'weekly')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Does not repeat</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {frequency === 'weekly' && (
                <div className="space-y-2">
                  <Label>Days</Label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((d) => {
                      const active = byDay.includes(d.code)
                      return (
                        <button
                          key={d.code}
                          type="button"
                          onClick={() => toggleDay(d.code)}
                          className={[
                            'h-8 px-2.5 rounded-md text-xs font-medium border',
                            active
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          {d.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {frequency !== 'none' && (
                <div className="space-y-1">
                  <Label htmlFor="block-until">Ends on (optional)</Label>
                  <Input
                    id="block-until"
                    type="date"
                    value={until}
                    onChange={(e) => setUntil(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          <div className="space-y-1">
            <Label htmlFor="block-notes">Notes</Label>
            <Input
              id="block-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEdit && (
            <div className="flex flex-wrap gap-2 mr-auto">
              {initial?.isRecurring && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleting || saving}
                  onClick={() => handleDelete('occurrence')}
                >
                  Remove occurrence
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="text-rose-700 border-rose-200 hover:bg-rose-50"
                disabled={deleting || saving}
                onClick={() => handleDelete('series')}
              >
                {initial?.isRecurring ? 'Delete series' : 'Delete'}
              </Button>
            </div>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || deleting}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
