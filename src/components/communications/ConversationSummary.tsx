"use client"

import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { ConversationSummaryData } from './types'

export function ConversationSummary({
  summary,
  loading,
  error,
  onRefresh,
}: {
  summary: ConversationSummaryData | null
  loading: boolean
  error: boolean
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(true)

  const updatedLabel = useMemo(() => {
    if (!summary?.lastGeneratedAt) return 'Updated just now'
    return `Updated ${formatDistanceToNow(new Date(summary.lastGeneratedAt), { addSuffix: true })}`
  }, [summary?.lastGeneratedAt])

  if (!summary && !loading && error) {
    return (
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Summary unavailable
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            AI Summary
          </div>
          {summary?.needsReview && (
            <div className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              Review carefully
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span>{summary?.confidence ? `${summary.confidence[0].toUpperCase()}${summary.confidence.slice(1)} confidence` : 'Confidence pending'}</span>
          <span>{updatedLabel}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="text-slate-500 hover:text-slate-700"
          >
            Refresh summary
          </button>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-slate-500 hover:text-slate-700"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              What happened
            </div>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-700">
              {(summary?.whatHappened ?? []).map((item) => (
                <li key={item}>{item}</li>
              ))}
              {!summary && loading && <li>Generating summary…</li>}
              {!summary && !loading && !error && <li>Summary unavailable</li>}
              {summary && summary.whatHappened.length === 0 && <li>No updates yet.</li>}
            </ul>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Latest ask
            </div>
            <div className="mt-1 text-xs text-slate-700">
              {summary?.latestPatientAsk || (loading ? 'Generating summary…' : 'Summary unavailable')}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Actions taken
            </div>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-700">
              {(summary?.actionsTaken ?? []).map((item) => (
                <li key={item}>{item}</li>
              ))}
              {!summary && loading && <li>Generating summary…</li>}
              {!summary && !loading && !error && <li>Summary unavailable</li>}
              {summary && summary.actionsTaken.length === 0 && <li>No action taken yet</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
