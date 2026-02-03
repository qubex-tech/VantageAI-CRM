"use client"

import { MessageTimeline } from './MessageTimeline'
import { Composer } from './Composer'
import { EmptyState } from './EmptyState'
import { Button } from '@/components/ui/button'
import type { Conversation, Message } from './types'

export function ConversationDetail({
  conversation,
  messages,
  loading,
  onSendMessage,
  onAssignClick,
  sending,
}: {
  conversation: Conversation | null
  messages: Message[]
  loading: boolean
  onSendMessage: (body: string) => void
  onAssignClick: () => void
  sending: boolean
}) {
  if (!conversation && !loading) {
    return (
      <section className="flex flex-1 items-center justify-center">
        <EmptyState
          title="Select a conversation"
          description="Choose a message thread to see the details."
        />
      </section>
    )
  }

  return (
    <section className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 px-8 py-5">
        {loading || !conversation ? (
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-28 rounded bg-slate-100 animate-pulse" />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">
                {conversation.patientName}
              </div>
              <div className="text-xs text-slate-500">
                {conversation.status} · {conversation.channel.toUpperCase()}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onAssignClick}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:text-slate-700"
              >
                {conversation.assignee ? `Assigned to ${conversation.assignee}` : 'Assign'}
              </button>
              <Button size="sm">Resolve</Button>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <MessageTimeline messages={messages} loading={loading} />
      </div>

      <div className="border-t border-slate-200 px-8 py-4">
        <Composer onSend={onSendMessage} disabled={sending} />
      </div>
    </section>
  )
}
