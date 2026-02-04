"use client"

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface PatientOption {
  id: string
  name: string
  email?: string | null
  primaryPhone?: string | null
  phone?: string | null
}

const channels = [
  { id: 'sms', label: 'SMS' },
  { id: 'email', label: 'Email' },
  { id: 'secure', label: 'Secure' },
]

export function NewMessagePanel({
  onStart,
  loading,
}: {
  onStart: (payload: { patientId: string; channel: string; body: string }) => Promise<void>
  loading: boolean
}) {
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [channel, setChannel] = useState('sms')
  const [body, setBody] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!query) {
      setPatients([])
      return
    }

    const timeout = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(query)}&limit=5`)
        const data = await res.json()
        setPatients(data.patients || [])
      } catch {
        setPatients([])
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [query])

  const canSend = Boolean(selectedPatient && body.trim())

  const patientLabel = useMemo(() => {
    if (!selectedPatient) return ''
    return selectedPatient.name || selectedPatient.email || selectedPatient.phone || 'Patient'
  }, [selectedPatient])

  return (
    <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-4">
      <div>
        <div className="text-base font-semibold text-slate-900">New message</div>
        <p className="text-sm text-slate-500">
          Start a new thread with any patient.
        </p>
      </div>

      <div className="space-y-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search patients..."
          className="h-9"
        />
        {searching && (
          <div className="text-xs text-slate-400">Searching…</div>
        )}
        {patients.length > 0 && (
          <div className="rounded-md border border-slate-200 bg-white">
            {patients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => {
                  setSelectedPatient(patient)
                  setQuery('')
                  setPatients([])
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="font-medium">{patient.name}</span>
                <span className="text-xs text-slate-400">
                  {patient.email || patient.primaryPhone || patient.phone || ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedPatient && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Sending to <span className="font-medium text-slate-900">{patientLabel}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        {channels.map((item) => (
          <button
            key={item.id}
            onClick={() => setChannel(item.id)}
            className={cn(
              'rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600',
              channel === item.id && 'border-slate-300 text-slate-900'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Type a reply…"
        className="min-h-[120px] resize-none border-slate-200 text-sm"
      />

      <Button
        onClick={async () => {
          if (!selectedPatient) return
          await onStart({
            patientId: selectedPatient.id,
            channel,
            body: body.trim(),
          })
          setBody('')
        }}
        disabled={!canSend || loading}
        size="sm"
        className="w-full"
      >
        Start conversation
      </Button>
      </div>
    </div>
  )
}
