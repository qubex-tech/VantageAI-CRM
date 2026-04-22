'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AnalyticsCallRow } from '@/lib/analytics/callSort'
import {
  COLUMN_SORT_KEYS,
  EXTRACTED_FIELD_SORT_KEYS,
  INSURANCE_VERIFICATION_SORT_KEYS,
  collectRetellCustomDataKeysFromRows,
  formatCallSortValueForDisplay,
  makeRetellCustomSortKey,
  sortCalls,
} from '@/lib/analytics/callSort'

export type CallAnalyticsSectionProps = {
  inboundCalls: AnalyticsCallRow[]
  /** yyyy-MM-dd */
  callFrom: string
  /** yyyy-MM-dd */
  callTo: string
  callRangeLabel: string
  callsLast7: number
  uniqueCallers: number
  avgCallSeconds: number
  completedCallCount: number
  completionRate: number
  sortedOutcomes: [string, number][]
  updatedAtLabel: string
}

const formatDuration = (seconds: number) => {
  if (!seconds || Number.isNaN(seconds)) {
    return '—'
  }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) {
    return '0%'
  }
  return `${Math.round(value * 100)}%`
}

function humanizeSortKey(key: string): string {
  if (key.startsWith('retell_custom_data:')) {
    return `Custom: ${key.slice('retell_custom_data:'.length)}`
  }
  return key.replace(/_/g, ' ').replace(/\./g, ' › ')
}

export function CallAnalyticsSection({
  inboundCalls,
  callFrom,
  callTo,
  callRangeLabel,
  callsLast7,
  uniqueCallers,
  avgCallSeconds,
  completedCallCount,
  completionRate,
  sortedOutcomes,
  updatedAtLabel,
}: CallAnalyticsSectionProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [fromInput, setFromInput] = useState(callFrom)
  const [toInput, setToInput] = useState(callTo)
  const [sortKey, setSortKey] = useState<string>('startedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  useEffect(() => {
    setFromInput(callFrom)
    setToInput(callTo)
  }, [callFrom, callTo])

  const customKeys = useMemo(() => collectRetellCustomDataKeysFromRows(inboundCalls), [inboundCalls])

  const sortedCalls = useMemo(
    () => sortCalls(inboundCalls, sortKey, sortOrder),
    [inboundCalls, sortKey, sortOrder]
  )

  const displayCalls = sortedCalls.slice(0, 24)

  const applyDateRange = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (fromInput) params.set('callFrom', fromInput)
    else params.delete('callFrom')
    if (toInput) params.set('callTo', toInput)
    else params.delete('callTo')
    const q = params.toString()
    router.push(q ? `/analytics?${q}` : '/analytics')
  }

  const syncFromRetell = async () => {
    setSyncError(null)
    setSyncMessage(null)
    setSyncLoading(true)
    try {
      const res = await fetch('/api/analytics/retell-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callFrom: fromInput || undefined,
          callTo: toInput || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        processed?: number
        fetched?: number
        failed?: number
      }
      if (!res.ok) {
        throw new Error(data.error || `Sync failed (${res.status})`)
      }
      const failedPart =
        typeof data.failed === 'number' && data.failed > 0 ? `, ${data.failed} failed` : ''
      setSyncMessage(
        `Updated from Retell: ${data.processed ?? 0} calls processed (${data.fetched ?? 0} fetched${failedPart}).`
      )
      router.refresh()
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncLoading(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Call analytics</h2>
          <p className="text-sm text-gray-500">Inbound voice agent performance</p>
          <p className="text-xs text-gray-400 mt-1">{callRangeLabel}</p>
        </div>
        <span className="text-xs text-gray-400 shrink-0">Updated {updatedAtLabel}</span>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
        <p className="text-xs text-gray-500">
          Dates are interpreted as UTC calendar days (same basis as Retell call timestamps).
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="call-from" className="text-xs font-medium text-gray-600">
            From (UTC)
          </label>
          <input
            id="call-from"
            type="date"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="call-to" className="text-xs font-medium text-gray-600">
            To (UTC)
          </label>
          <input
            id="call-to"
            type="date"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyDateRange}
            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800"
          >
            Apply range
          </button>
          <button
            type="button"
            onClick={syncFromRetell}
            disabled={syncLoading}
            title="Fetch latest inbound calls from Retell for this range and update CRM records"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 shrink-0 ${syncLoading ? 'animate-spin' : ''}`} aria-hidden />
            {syncLoading ? 'Syncing…' : 'Refresh from Retell'}
          </button>
        </div>
        </div>
        {syncError ? <p className="text-sm text-red-600">{syncError}</p> : null}
        {syncMessage ? <p className="text-sm text-green-700">{syncMessage}</p> : null}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-end sm:gap-4">
        <div className="flex flex-col gap-1 min-w-[200px] flex-1">
          <label htmlFor="call-sort-key" className="text-xs font-medium text-gray-600">
            Sort calls by
          </label>
          <select
            id="call-sort-key"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm"
          >
            <optgroup label="Call record">
              {COLUMN_SORT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {humanizeSortKey(k)}
                </option>
              ))}
            </optgroup>
            <optgroup label="Retell extracted">
              {EXTRACTED_FIELD_SORT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {humanizeSortKey(k)}
                </option>
              ))}
            </optgroup>
            <optgroup label="Insurance (extracted)">
              {INSURANCE_VERIFICATION_SORT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {humanizeSortKey(k)}
                </option>
              ))}
            </optgroup>
            {customKeys.length > 0 ? (
              <optgroup label="Retell custom analysis">
                {customKeys.map((k) => (
                  <option key={k} value={makeRetellCustomSortKey(k)}>
                    {k}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="call-sort-order" className="text-xs font-medium text-gray-600">
            Order
          </label>
          <select
            id="call-sort-order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total inbound calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{inboundCalls.length}</div>
            <p className="text-xs text-gray-500 mt-1">{callsLast7} in the last 7 days</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Unique callers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{uniqueCallers}</div>
            <p className="text-xs text-gray-500 mt-1">Distinct phone numbers</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Avg. duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{formatDuration(avgCallSeconds)}</div>
            <p className="text-xs text-gray-500 mt-1">{completedCallCount} completed calls</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Completion rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">
              {formatPercent(inboundCalls.length > 0 ? completionRate : 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Calls with an end timestamp</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-900">Call outcomes</CardTitle>
            <CardDescription className="text-sm text-gray-500">Selected date range</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedOutcomes.length === 0 ? (
              <p className="text-sm text-gray-500">No call outcomes recorded.</p>
            ) : (
              <div className="space-y-2">
                {sortedOutcomes.map(([outcome, count]) => (
                  <div key={outcome} className="flex items-center justify-between text-sm text-gray-700">
                    <span className="capitalize">{outcome.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-900">Calls</CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Sorted by {humanizeSortKey(sortKey)} ({sortOrder === 'asc' ? 'ascending' : 'descending'}) · up to 24
              shown
            </CardDescription>
          </CardHeader>
          <CardContent>
            {displayCalls.length === 0 ? (
              <p className="text-sm text-gray-500">No inbound calls in this range.</p>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {displayCalls.map((call, index) => (
                  <div
                    key={`${String(call.startedAt)}-${index}`}
                    className="flex flex-col gap-1 border-b border-gray-100 pb-3 last:border-0 last:pb-0 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {call.callerPhone ? call.callerPhone : 'Unknown caller'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(call.startedAt), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 capitalize shrink-0">
                        {(call.outcome || 'unknown').replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      <span className="font-medium text-gray-600">{humanizeSortKey(sortKey)}:</span>{' '}
                      {formatCallSortValueForDisplay(call, sortKey)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
