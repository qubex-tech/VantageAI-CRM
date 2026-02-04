"use client"

import { format } from 'date-fns'
import type { ElementType } from 'react'
import { Lock, Mail, MessageSquare, Phone, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from './types'

const channelMeta: Record<string, { label: string; icon: ElementType }> = {
  sms: { label: 'SMS', icon: MessageSquare },
  email: { label: 'Email', icon: Mail },
  secure: { label: 'Secure', icon: Lock },
  voice: { label: 'Voice', icon: Phone },
  video: { label: 'Video', icon: Video },
}

export function MessageBubble({ message }: { message: Message }) {
  const isStaff = message.senderType === 'staff'
  const isInternal = message.isInternalNote
  const meta = channelMeta[message.channel] || { label: message.channel, icon: MessageSquare }
  const Icon = meta.icon

  return (
    <div className={cn('flex', isStaff ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'group max-w-[72%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
          isInternal
            ? 'border border-slate-200 bg-slate-50 text-slate-600'
            : isStaff
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-900 border border-slate-200'
        )}
      >
        <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
          {isInternal ? (
            <span className="italic">Internal</span>
          ) : (
            <>
              <Icon className="h-3.5 w-3.5" />
              <span>{meta.label}</span>
            </>
          )}
        </div>
        <div className="whitespace-pre-wrap">{message.body}</div>
        <div className="mt-2 text-[11px] text-slate-400 opacity-0 transition group-hover:opacity-100">
          {format(new Date(message.createdAt), 'MMM d · h:mm a')}
        </div>
      </div>
    </div>
  )
}
