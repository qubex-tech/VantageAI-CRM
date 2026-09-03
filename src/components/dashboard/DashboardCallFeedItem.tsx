'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Phone, PhoneForwarded, PhoneOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CallFeedItem } from '@/lib/dashboard/callFeed'

export interface DashboardCallFeedItemProps {
  item: CallFeedItem
  practiceId: string
  timeZone: string
}

const TRANSFER_BADGE: Record<
  CallFeedItem['transferStatus'],
  { label: string; className: string; Icon: typeof Phone }
> = {
  none: {
    label: 'Not transferred',
    className: 'bg-gray-100 text-gray-600',
    Icon: Phone,
  },
  successful: {
    label: 'Transferred',
    className: 'bg-orange-50 text-orange-500',
    Icon: PhoneForwarded,
  },
  unsuccessful: {
    label: 'Failed transfer',
    className: 'bg-red-50 text-red-700',
    Icon: PhoneOff,
  },
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return remaining === 0 ? `${minutes}m` : `${minutes}m ${remaining}s`
}

function formatClock(startedAt: string, timeZone: string): string {
  return new Date(startedAt).toLocaleTimeString('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function DashboardCallFeedItem({
  item,
  practiceId,
  timeZone,
}: DashboardCallFeedItemProps) {
  const badge = TRANSFER_BADGE[item.transferStatus]
  const BadgeIcon = badge.Icon
  const href = item.retellCallId
    ? `/calls/${encodeURIComponent(item.retellCallId)}?practiceId=${encodeURIComponent(practiceId)}`
    : null
  const relativeTime = formatDistanceToNow(new Date(item.startedAt), { addSuffix: true })

  const body = (
    <article
      className={cn(
        'rounded-xl border border-gray-100 bg-white p-4 shadow-lg shadow-gray-200/50 transition-shadow sm:p-5',
        href && 'hover:shadow-xl hover:shadow-gray-200/60',
        item.transferStatus === 'unsuccessful' && 'border-l-4 border-l-red-500'
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">
              {item.callerDisplayName}
            </h3>
            {item.callerPhone && item.callerPhone !== item.callerDisplayName ? (
              <span className="text-xs text-gray-400">{item.callerPhone}</span>
            ) : null}
          </div>
          <p
            className={cn(
              'mt-1.5 text-sm leading-relaxed',
              item.summary ? 'text-gray-700' : 'text-gray-400 italic'
            )}
          >
            {item.summary ?? 'Summary not available yet'}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <span
            title={item.transferOutcomeRaw ?? undefined}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              badge.className
            )}
          >
            <BadgeIcon className="h-3 w-3" />
            {badge.label}
          </span>
          <p className="text-xs text-gray-400">
            {relativeTime}
            <span className="mx-1 text-gray-300">·</span>
            {formatClock(item.startedAt, timeZone)}
            {item.durationSeconds != null ? (
              <>
                <span className="mx-1 text-gray-300">·</span>
                {formatDuration(item.durationSeconds)}
              </>
            ) : null}
          </p>
        </div>
      </div>
    </article>
  )

  if (!href) return body

  return (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2">
      {body}
    </Link>
  )
}
