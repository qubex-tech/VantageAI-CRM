"use client"

import { formatDistanceToNow } from 'date-fns'
import { MessageSquare, Lock, Phone, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConversationListItem } from './InboxShell'

const channelIcon = {
  sms: MessageSquare,
  secure: Lock,
  voice: Phone,
  video: Video,
}

export function ConversationList({
  conversations,
  loading,
  selectedId,
  onSelect,
}: {
  conversations: ConversationListItem[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="flex h-full w-[340px] flex-col border-r border-slate-200">
      <div className="border-b border-slate-200 px-4 py-4">
        <h3 className="text-sm font-medium text-slate-600">Conversations</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-4 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-2 rounded-lg border border-slate-100 p-3">
                <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
                <div className="h-3 w-full rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No conversations in this view yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {conversations.map((conversation) => {
              const Icon = channelIcon[conversation.channel]
              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelect(conversation.id)}
                  className={cn(
                    'flex w-full flex-col gap-2 px-4 py-4 text-left transition',
                    selectedId === conversation.id ? 'bg-slate-50' : 'hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-900">
                        {conversation.patient.name}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {conversation.lastMessageAt
                        ? formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })
                        : 'Just now'}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs text-slate-500">
                    {conversation.lastMessagePreview || 'No messages yet.'}
                  </p>
                  <div className="flex items-center justify-between">
                    {conversation.assignee ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                        {conversation.assignee.name}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Unassigned</span>
                    )}
                    {conversation.unread ? (
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
