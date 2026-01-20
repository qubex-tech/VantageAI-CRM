'use client'

import { useEffect, useState } from 'react'
import { Sparkles, ArrowRight, Clock, CalendarDays } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  setHealixContextOverride,
  setHealixPendingPrompt,
  setHealixPanelOpen,
} from '@/components/healix/HealixButton'
import type { HealixContextPayload } from '@/hooks/useHealixContext'
import { cn } from '@/lib/utils'

interface HealixCommandCenterProps {
  context: HealixContextPayload
  stats?: {
    recentPatients: number
    recentNotes: number
    upcomingPatients: number
    upcomingAppointments: number
  }
}

const suggestedPrompts = [
  { label: 'Summarize the last 7 days', prompt: 'Summarize key patient activity from the last 7 days.' },
  { label: 'Prepare me for next 7 days', prompt: 'Give me a prep summary for the next 7 days of patients.' },
  { label: 'Patients needing follow-up', prompt: 'Which patients from the last 7 days need follow-up?' },
]

export function HealixCommandCenter({ context, stats }: HealixCommandCenterProps) {
  const [prompt, setPrompt] = useState('')

  useEffect(() => {
    setHealixContextOverride(context)
    return () => {
      setHealixContextOverride(null)
    }
  }, [context])

  const sendPrompt = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setHealixPendingPrompt(trimmed)
    setHealixPanelOpen(true)
    setPrompt('')
  }

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault()
    sendPrompt(prompt)
  }

  return (
    <Card className="border border-gray-200 shadow-sm bg-gradient-to-br from-white to-slate-50">
      <div className="p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-900 text-white px-3 py-1 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Healix Command Center
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">
              Ask anything about your last 7 days and next 7 days.
            </h2>
            <p className="text-sm text-gray-600 max-w-2xl">
              Healix comes pre-loaded with recent and upcoming patient context, and can fetch deeper
              details on demand.
            </p>
          </div>
          {stats && (
            <div className="hidden lg:grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="h-4 w-4" />
                  Last 7 days
                </div>
                <div className="mt-1 font-semibold text-gray-900">
                  {stats.recentPatients} patients · {stats.recentNotes} notes
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="flex items-center gap-2 text-gray-500">
                  <CalendarDays className="h-4 w-4" />
                  Next 7 days
                </div>
                <div className="mt-1 font-semibold text-gray-900">
                  {stats.upcomingPatients} patients · {stats.upcomingAppointments} appts
                </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder="Ask Healix to summarize, draft, or prepare you for the week…"
            className="min-h-[120px] text-base bg-white"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="gap-2 bg-gray-900 hover:bg-gray-800 text-white">
              Ask Healix
              <ArrowRight className="h-4 w-4" />
            </Button>
            <span className="text-xs text-gray-500">Press Enter to send • Shift+Enter for a new line</span>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          {suggestedPrompts.map((item) => (
            <Button
              key={item.label}
              type="button"
              variant="outline"
              size="sm"
              className={cn('text-xs text-gray-700')}
              onClick={() => sendPrompt(item.prompt)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  )
}
