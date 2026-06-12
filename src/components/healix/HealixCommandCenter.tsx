'use client'

import { useEffect, useState } from 'react'
import { Sparkles, ArrowRight, Phone, PhoneForwarded, PhoneOff } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  setHealixContextOverride,
  setHealixPendingPrompt,
  setHealixPanelOpen,
} from '@/components/healix/HealixButton'
import type { HealixContextPayload } from '@/hooks/useHealixContext'

export interface HealixFrontDeskStats {
  callsHandled: number
  transfersSuccessful: number
  transfersUnsuccessful: number
  transfersAttempted: number
  days: number
}

interface HealixCommandCenterProps {
  context: HealixContextPayload
  frontDeskStats?: HealixFrontDeskStats
}

const frontDeskPrompts = [
  {
    label: 'Inbound call summary',
    prompt: 'Summarize inbound call volume and outcomes for the selected date range.',
  },
  {
    label: 'Transfer performance',
    prompt: 'How are call transfers performing? Break down successful vs failed transfers.',
  },
  {
    label: 'Failed transfer patterns',
    prompt: 'Which failed transfers stand out, and what might be causing them?',
  },
]

export function HealixCommandCenter({ context, frontDeskStats }: HealixCommandCenterProps) {
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
    <Card className="border border-gray-100 bg-white shadow-lg shadow-gray-200/50 overflow-hidden">
      <div className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/50 focus-within:border-gray-300 focus-within:bg-white transition-colors px-3">
            <Sparkles className="h-4 w-4 text-lime-600 flex-shrink-0" />
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="Ask Healix about your AI front desk performance…"
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
          {frontDeskStats && (
            <span className="text-xs text-gray-500 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-lime-600" />
                <span>
                  <span className="font-medium text-lime-600">{frontDeskStats.callsHandled}</span>{' '}
                  inbound calls ({frontDeskStats.days}d)
                </span>
              </span>
              <span className="text-gray-300 hidden sm:inline">·</span>
              <span className="flex items-center gap-1">
                <PhoneForwarded className="h-3.5 w-3.5 text-orange-400" />
                <span>
                  <span className="font-medium text-orange-400">{frontDeskStats.transfersSuccessful}</span>{' '}
                  transferred
                </span>
              </span>
              <span className="text-gray-300 hidden sm:inline">·</span>
              <span className="flex items-center gap-1">
                <PhoneOff className="h-3.5 w-3.5 text-red-600" />
                <span>
                  <span className="font-medium text-red-600">{frontDeskStats.transfersUnsuccessful}</span>{' '}
                  failed to transfer
                </span>
              </span>
            </span>
          )}
          <div className="flex flex-wrap gap-1.5">
            {frontDeskPrompts.map((item) => (
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
