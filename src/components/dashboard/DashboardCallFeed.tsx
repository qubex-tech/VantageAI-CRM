'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DashboardCallFeedItem } from '@/components/dashboard/DashboardCallFeedItem'
import {
  CALL_FEED_PAGE_SIZE,
  callFeedDayKey,
  formatCallFeedDayLabel,
  type CallFeedItem,
  type CallFeedPage,
} from '@/lib/dashboard/callFeed'

interface DashboardCallFeedProps {
  practiceId: string
  timeZone: string
  rangeFrom: string
  rangeTo: string
  initialPage: CallFeedPage
  initialRangeFrom: string
  initialRangeTo: string
}

function feedUrl(rangeFrom: string, rangeTo: string, cursor?: string | null) {
  const params = new URLSearchParams({
    from: rangeFrom,
    to: rangeTo,
    limit: String(CALL_FEED_PAGE_SIZE),
  })
  if (cursor) params.set('cursor', cursor)
  return `/api/dashboard/call-feed?${params.toString()}`
}

export function DashboardCallFeed({
  practiceId,
  timeZone,
  rangeFrom,
  rangeTo,
  initialPage,
  initialRangeFrom,
  initialRangeTo,
}: DashboardCallFeedProps) {
  const usesInitialPage = rangeFrom === initialRangeFrom && rangeTo === initialRangeTo
  const [items, setItems] = useState<CallFeedItem[]>(usesInitialPage ? initialPage.items : [])
  const [nextCursor, setNextCursor] = useState<string | null>(
    usesInitialPage ? initialPage.nextCursor : null
  )
  const [loading, setLoading] = useState(!usesInitialPage)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (rangeFrom === initialRangeFrom && rangeTo === initialRangeTo) {
      setItems(initialPage.items)
      setNextCursor(initialPage.nextCursor)
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void fetch(feedUrl(rangeFrom, rangeTo), { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || 'Could not load calls')
        }
        return res.json() as Promise<CallFeedPage>
      })
      .then((page) => {
        setItems(page.items)
        setNextCursor(page.nextCursor)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setItems([])
        setNextCursor(null)
        setError(err instanceof Error ? err.message : 'Could not load calls')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [initialPage, initialRangeFrom, initialRangeTo, rangeFrom, rangeTo])

  const groups = useMemo(() => {
    const result: { key: string; label: string; items: CallFeedItem[] }[] = []
    const index = new Map<string, number>()
    for (const item of items) {
      const key = callFeedDayKey(item.startedAt, timeZone)
      const existing = index.get(key)
      if (existing == null) {
        index.set(key, result.length)
        result.push({
          key,
          label: formatCallFeedDayLabel(item.startedAt, timeZone),
          items: [item],
        })
      } else {
        result[existing].items.push(item)
      }
    }
    return result
  }, [items, timeZone])

  const loadMore = async () => {
    if (!nextCursor || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(feedUrl(rangeFrom, rangeTo, nextCursor))
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || 'Could not load more calls')
      }
      const page = (await res.json()) as CallFeedPage
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id))
        return [...current, ...page.items.filter((item) => !seen.has(item.id))]
      })
      setNextCursor(page.nextCursor)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more calls')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Feed</h2>
        <p className="text-sm text-gray-500">Inbound front desk activity</p>
      </div>

      {items.length === 0 && !loading ? (
        <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-500 shadow-lg shadow-gray-200/50">
          No inbound calls in this range.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                {group.label}
              </h3>
              <div className="space-y-3">
                {group.items.map((item) => (
                  <DashboardCallFeedItem
                    key={item.id}
                    item={item}
                    practiceId={practiceId}
                    timeZone={timeZone}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="h-24 rounded-xl border border-gray-100 bg-white shadow-lg shadow-gray-200/50 animate-pulse"
            />
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {nextCursor ? (
        <div className="mt-5 flex justify-center">
          <Button type="button" variant="outline" onClick={() => void loadMore()} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
