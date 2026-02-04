"use client"

import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Conversation } from './types'

const channelLabel: Record<string, string> = {
  sms: 'SMS',
  email: 'Email',
  secure: 'Secure',
  voice: 'Voice',
  video: 'Video',
}

export function ConversationRow({
  conversation,
  selected,
  onClick,
}: {
  conversation: Conversation
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-full rounded-lg px-4 py-3 text-left transition',
        selected ? 'bg-slate-50' : 'hover:bg-slate-50'
      )}
    >
      {selected && <span className="absolute left-0 top-3 h-8 w-[2px] bg-slate-300" />}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">{conversation.patientName}</div>
        <div className="text-xs text-slate-400">
          {conversation.updatedAt
            ? formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })
            : ''}
        </div>
      </div>
      <div className="mt-1 text-xs text-slate-500 line-clamp-1">
        {conversation.lastMessageSnippet || 'No messages yet.'}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
        <span>{channelLabel[conversation.channel] || conversation.channel}</span>
        {conversation.unread && <span className="h-2 w-2 rounded-full bg-slate-400" />}
      </div>
    </button>
  )
}
