"use client"

import { cn } from '@/lib/utils'
import type { ConversationView } from './types'

const views: ConversationView[] = ['Open', 'Pending', 'Resolved', 'Mine', 'Team']

export function Sidebar({
  activeView,
  onChangeView,
  unreadCount,
}: {
  activeView: ConversationView
  onChangeView: (view: ConversationView) => void
  unreadCount: number
}) {
  return (
    <aside className="flex h-full w-40 flex-col border-r border-slate-200 px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-slate-900">Inbox</div>
        {unreadCount > 0 && (
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">
            {unreadCount}
          </span>
        )}
      </div>
      <div className="mt-6 space-y-1">
        {views.map((view) => (
          <button
            key={view}
            onClick={() => onChangeView(view)}
            className={cn(
              'w-full rounded-md px-2 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50',
              activeView === view && 'font-semibold text-slate-900'
            )}
          >
            {view}
          </button>
        ))}
      </div>
      <div className="mt-auto text-xs text-slate-400">
        Press <span className="text-slate-500">j / k</span> to move,{' '}
        <span className="text-slate-500">Enter</span> to open.
      </div>
    </aside>
  )
}
