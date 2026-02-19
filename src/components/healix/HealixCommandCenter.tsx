'use client'

import { useEffect, useState } from 'react'
import { Sparkles, ArrowRight, Clock, CalendarDays } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  setHealixContextOverride,
  setHealixPendingPrompt,
  setHealixPanelOpen,
} from '@/components/healix/HealixButton'
import type { HealixContextPayload } from '@/hooks/useHealixContext'

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
  { label: 'Summarize last 7 days', prompt: 'Summarize key patient activity from the last 7 days.' },
  { label: 'Prep for next 7 days', prompt: 'Give me a prep summary for the next 7 days of patients.' },
  { label: 'Needing follow-up', prompt: 'Which patients from the last 7 days need follow-up?' },
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
    <Card className="border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/50 focus-within:border-gray-300 focus-within:bg-white transition-colors px-3">
            <Sparkles className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="Ask Healix anything about your patients…"
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 py-5 text-sm placeholder:text-gray-400"
              aria-label="Message Healix"
            />
            <Button
              type="submit"
              size="sm"
              className="rounded-md bg-gray-900 hover:bg-gray-800 text-white flex-shrink-0 gap-1.5"
            >
              Ask
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {stats && (
            <span className="text-xs text-gray-500 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {stats.recentPatients} patients, {stats.recentNotes} notes
              </span>
              <span className="text-gray-300">·</span>
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {stats.upcomingPatients} patients, {stats.upcomingAppointments} appts
              </span>
            </span>
          )}
          <div className="flex flex-wrap gap-1.5">
            {suggestedPrompts.map((item) => (
              <button
                key={item.label}
                type="button"
                className="text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-2 py-1 rounded-md transition-colors"
                onClick={() => sendPrompt(item.prompt)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
