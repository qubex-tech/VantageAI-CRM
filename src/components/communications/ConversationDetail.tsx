"use client"

import { useState } from 'react'
import { MessageTimeline } from './MessageTimeline'
import { Composer, type AttachmentDraft } from './Composer'
import type { ConversationDetailData, MessageItem } from './InboxShell'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ConversationDetail({
  conversation,
  loading,
  messages,
  onSendMessage,
  onAddNote,
  onAssign,
  onResolve,
  sending,
}: {
  conversation: ConversationDetailData | null
  loading: boolean
  messages: MessageItem[]
  onSendMessage: (body: string, attachments: AttachmentDraft[]) => void
  onAddNote: (body: string) => void
  onAssign: (assigneeType: 'user' | 'team', assigneeId: string) => void
  onResolve: () => void
  sending: boolean
}) {
  const [showAssign, setShowAssign] = useState(false)
  const [assigneeType, setAssigneeType] = useState<'user' | 'team'>('user')
  const [assigneeId, setAssigneeId] = useState('')

  if (!conversation && !loading) {
    return (
      <section className="flex h-full flex-1 flex-col items-center justify-center text-center">
        <div className="max-w-sm space-y-3">
          <div className="text-lg font-medium text-slate-900">Your inbox is clear.</div>
          <p className="text-sm text-slate-500">
            Select a conversation on the left to see details, or adjust your filters.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="flex h-full flex-1 flex-col">
      <div className="border-b border-slate-200 px-6 py-4">
        {loading || !conversation ? (
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-48 rounded bg-slate-100 animate-pulse" />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-slate-900">
                {conversation.patient.name}
              </div>
              <div className="text-xs text-slate-500">
                {conversation.channel.toUpperCase()} · {conversation.status}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {conversation.assignee ? (
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {conversation.assignee.name}
                </span>
              ) : (
                <span className="text-xs text-slate-400">Unassigned</span>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowAssign((prev) => !prev)}>
                Assign
              </Button>
              <Button size="sm" onClick={onResolve}>
                Resolve
              </Button>
            </div>
          </div>
        )}

        {showAssign && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <button
                className={cn(
                  'rounded-md px-3 py-1 text-xs',
                  assigneeType === 'user' ? 'bg-white text-slate-900' : 'text-slate-500'
                )}
                onClick={() => setAssigneeType('user')}
              >
                User
              </button>
              <button
                className={cn(
                  'rounded-md px-3 py-1 text-xs',
                  assigneeType === 'team' ? 'bg-white text-slate-900' : 'text-slate-500'
                )}
                onClick={() => setAssigneeType('team')}
              >
                Team
              </button>
            </div>
            <Input
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              placeholder="Assignee ID"
              className="h-8 w-56 bg-white text-xs"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (assigneeId) {
                  onAssign(assigneeType, assigneeId)
                  setAssigneeId('')
                  setShowAssign(false)
                }
              }}
            >
              Apply
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <MessageTimeline loading={loading} messages={messages} />
      </div>

      <div className="border-t border-slate-200 px-6 py-4">
        <Composer onSend={onSendMessage} onAddNote={onAddNote} disabled={sending} />
      </div>
    </section>
  )
}
