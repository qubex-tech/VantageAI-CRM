"use client"

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { CommunicationChannel, ConversationStatus } from '@/lib/communications/types'

type AssigneeFilter = 'me' | 'team' | 'all'

interface FiltersState {
  status: ConversationStatus
  assignee: AssigneeFilter
  channel: CommunicationChannel | 'all'
  search: string
}

export function InboxSidebar({
  filters,
  onChange,
}: {
  filters: FiltersState
  onChange: (next: FiltersState) => void
}) {
  const views = [
    { label: 'Open', status: 'open' as ConversationStatus },
    { label: 'Pending', status: 'pending' as ConversationStatus },
    { label: 'Resolved', status: 'resolved' as ConversationStatus },
  ]

  const assignees = [
    { label: 'All', value: 'all' as AssigneeFilter },
    { label: 'Mine', value: 'me' as AssigneeFilter },
    { label: 'Team', value: 'team' as AssigneeFilter },
  ]

  const channels: Array<{ label: string; value: CommunicationChannel | 'all' }> = [
    { label: 'All channels', value: 'all' },
    { label: 'SMS', value: 'sms' },
    { label: 'Secure', value: 'secure' },
    { label: 'Voice', value: 'voice' },
    { label: 'Video', value: 'video' },
  ]

  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-200 bg-slate-50/60 px-4 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Inbox</h2>
        <span className="text-xs text-slate-500">j / k</span>
      </div>

      <div className="mt-4">
        <Input
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Search conversations"
          className="h-9 bg-white"
        />
      </div>

      <div className="mt-6 space-y-1">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Views</div>
        {views.map((view) => (
          <button
            key={view.label}
            className={cn(
              'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-slate-700 transition',
              filters.status === view.status ? 'bg-white text-slate-900' : 'hover:bg-white/80'
            )}
            onClick={() => onChange({ ...filters, status: view.status })}
          >
            {view.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-1">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Assignee</div>
        {assignees.map((item) => (
          <button
            key={item.value}
            className={cn(
              'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-slate-700 transition',
              filters.assignee === item.value ? 'bg-white text-slate-900' : 'hover:bg-white/80'
            )}
            onClick={() => onChange({ ...filters, assignee: item.value })}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-1">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Channel</div>
        {channels.map((item) => (
          <button
            key={item.value}
            className={cn(
              'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-slate-700 transition',
              filters.channel === item.value ? 'bg-white text-slate-900' : 'hover:bg-white/80'
            )}
            onClick={() => onChange({ ...filters, channel: item.value })}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-auto rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
        Tip: Press <span className="font-medium text-slate-700">Enter</span> to open,
        <span className="font-medium text-slate-700"> Esc</span> to close.
      </div>
    </aside>
  )
}
