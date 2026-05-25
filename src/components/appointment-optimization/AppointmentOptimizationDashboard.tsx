'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SlotRow = {
  id: string
  providerId: string | null
  appointmentType: string
  slotStart: string
  slotEnd: string
  durationMinutes: number
  status: string
  wavesSent: number
  patientsContacted: number
  waves: Array<{ waveNumber: number; status: string; patientsTargeted: number }>
  attempts: Array<{
    id: string
    waveNumber: number
    status: string
    channel: string
    sentAt: string | null
    patient: { name: string }
  }>
}

type Stats = {
  open: number
  filled: number
  exhausted: number
  totalAttempts: number
}

export function AppointmentOptimizationDashboard() {
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'open' | 'all' | 'filled'>('open')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/appointment-optimization/slots?status=${filter === 'all' ? 'all' : filter}`
      )
      const data = await res.json()
      if (res.ok) {
        setSlots(data.slots || [])
        setStats(data.stats || null)
      }
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const checkSlot = async (id: string) => {
    await fetch(`/api/appointment-optimization/slots/${id}/status`)
    load()
  }

  const conversionRate = (slot: SlotRow) => {
    if (slot.patientsContacted === 0) return '—'
    if (slot.status === 'filled') return '100%'
    return '0%'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-2">
          {(['open', 'filled', 'all'] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? 'default' : 'outline'}
              onClick={() => setFilter(value)}
            >
              {value === 'open' ? 'Active' : value === 'filled' ? 'Filled' : 'All'}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Open slots</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stats.open}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Filled</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stats.filled}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Exhausted</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stats.exhausted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Outreach sent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stats.totalAttempts}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        {slots.length === 0 && !loading && (
          <p className="text-sm text-gray-500 py-8 text-center">No open slots in this view.</p>
        )}
        {slots.map((slot) => (
          <Card key={slot.id} className="border border-gray-200">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {format(new Date(slot.slotStart), 'EEE MMM d, h:mm a')} — {slot.appointmentType}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    {slot.durationMinutes} min · {slot.status} · {slot.patientsContacted} contacted ·{' '}
                    {slot.wavesSent} wave(s) · conversion {conversionRate(slot)}
                  </p>
                </div>
                {slot.status === 'open' && (
                  <Button size="sm" variant="outline" onClick={() => checkSlot(slot.id)}>
                    Check if filled
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {slot.waves.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Waves</p>
                  <div className="flex flex-wrap gap-2">
                    {slot.waves.map((w) => (
                      <span
                        key={w.waveNumber}
                        className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700"
                      >
                        Wave {w.waveNumber}: {w.status} ({w.patientsTargeted} patients)
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {slot.attempts.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Recent outreach</p>
                  <ul className="text-sm space-y-1">
                    {slot.attempts.slice(0, 8).map((a) => (
                      <li key={a.id} className="text-gray-700">
                        Wave {a.waveNumber}: {a.patient.name} — {a.channel} — {a.status}
                        {a.sentAt ? ` · ${format(new Date(a.sentAt), 'MMM d h:mm a')}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
