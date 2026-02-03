"use client"

import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Message } from './types'

export function MessageBubble({ message }: { message: Message }) {
  const isStaff = message.senderType === 'staff'
  const isInternal = message.isInternalNote

  return (
    <div className={cn('flex', isStaff ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'group max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isInternal
            ? 'border border-slate-200 bg-slate-50 text-slate-600'
            : isStaff
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-800'
        )}
      >
        {isInternal && (
          <div className="mb-2 text-[11px] italic text-slate-400">Internal</div>
        )}
        <div className="whitespace-pre-wrap">{message.body}</div>
        <div className="mt-2 text-[11px] text-slate-400 opacity-0 transition group-hover:opacity-100">
          {format(new Date(message.createdAt), 'MMM d · h:mm a')}
        </div>
      </div>
    </div>
  )
}
