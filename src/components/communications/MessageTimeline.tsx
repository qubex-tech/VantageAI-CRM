"use client"

import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { MessageItem } from './InboxShell'

export function MessageTimeline({
  messages,
  loading,
}: {
  messages: MessageItem[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
            <div className="h-10 w-full rounded bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        No messages yet. Start the conversation with a friendly hello.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isInternal = message.type === 'note' || message.direction === 'internal'
        const isOutbound = message.direction === 'outbound'

        return (
          <div key={message.id} className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                isInternal
                  ? 'border border-dashed border-slate-200 bg-slate-50 text-slate-600'
                  : isOutbound
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-800'
              )}
            >
              <div className="whitespace-pre-wrap">{message.body}</div>
              <div className="mt-2 text-[11px] text-slate-400">
                {format(new Date(message.createdAt), 'MMM d · h:mm a')}
                {message.intent ? ` · intent: ${message.intent}` : ''}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
