'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export type AnalyticsCallDateRangeBarProps = {
  /** yyyy-MM-dd */
  callFrom: string
  /** yyyy-MM-dd */
  callTo: string
  callRangeLabel: string
}

export function AnalyticsCallDateRangeBar({ callFrom, callTo, callRangeLabel }: AnalyticsCallDateRangeBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [fromInput, setFromInput] = useState(callFrom)
  const [toInput, setToInput] = useState(callTo)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  useEffect(() => {
    setFromInput(callFrom)
    setToInput(callTo)
  }, [callFrom, callTo])

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
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="text-sm font-medium text-gray-800">Call date range</p>
        <p className="text-xs text-gray-500">{callRangeLabel}</p>
      </div>
      <p className="text-xs text-gray-500">
        Dates are interpreted as UTC calendar days (same basis as Retell call timestamps). Applies to
        Call analytics and Reporting.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="analytics-call-from" className="text-xs font-medium text-gray-600">
            From (UTC)
          </label>
          <input
            id="analytics-call-from"
            type="date"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="analytics-call-to" className="text-xs font-medium text-gray-600">
            To (UTC)
          </label>
          <input
            id="analytics-call-to"
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
            {syncLoading ? 'Syncing…' : 'Refresh'}
          </button>
        </div>
      </div>
      {syncError ? <p className="text-sm text-red-600">{syncError}</p> : null}
      {syncMessage ? <p className="text-sm text-green-700">{syncMessage}</p> : null}
    </div>
  )
}
