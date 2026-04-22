'use client'

import { useCallback, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AnalyticsCallRow } from '@/lib/analytics/callSort'
import {
  COLUMN_SORT_KEYS,
  EXTRACTED_FIELD_SORT_KEYS,
  INSURANCE_VERIFICATION_SORT_KEYS,
  collectRetellCustomDataKeysFromRows,
  formatCallSortValueForDisplay,
  getCallerDisplayName,
  getCallSortValue,
  makeRetellCustomSortKey,
} from '@/lib/analytics/callSort'

function humanizeColumnKey(key: string): string {
  if (key.startsWith('retell_custom_data:')) {
    return key.slice('retell_custom_data:'.length)
  }
  return key.replace(/_/g, ' ').replace(/\./g, ' › ')
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—'
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function callDurationSeconds(row: AnalyticsCallRow): number | null {
  const v = getCallSortValue(row, 'durationSeconds')
  return typeof v === 'number' ? v : null
}

function callTimeLocalDisplay(row: AnalyticsCallRow): string {
  const d = new Date(row.startedAt)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function cellDisplay(row: AnalyticsCallRow, key: string): string {
  if (key === 'outcome') {
    return row.outcome ? String(row.outcome).replace(/_/g, ' ') : '—'
  }
  return formatCallSortValueForDisplay(row, key)
}

function rowMatchesFilters(
  row: AnalyticsCallRow,
  keys: string[],
  filters: Record<string, string>
): boolean {
  for (const key of keys) {
    const raw = filters[key]?.trim()
    if (!raw) continue
    if (key === 'outcome') {
      const o = row.outcome || ''
      if (o !== raw) return false
      continue
    }
    const cell = cellDisplay(row, key).toLowerCase()
    if (!cell.includes(raw.toLowerCase())) return false
  }
  return true
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

type CallReportingTableProps = {
  rows: AnalyticsCallRow[]
  callRangeLabel?: string
}

export function CallReportingTable({ rows, callRangeLabel }: CallReportingTableProps) {
  const [dynamicKeys, setDynamicKeys] = useState<string[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [pendingKey, setPendingKey] = useState<string>('')

  const customKeys = useMemo(() => collectRetellCustomDataKeysFromRows(rows), [rows])

  const distinctOutcomes = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows) {
      if (r.outcome) s.add(r.outcome)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const addableOptions = useMemo(() => {
    const opts: { value: string; label: string; group: string }[] = []
    for (const k of COLUMN_SORT_KEYS) {
      if (k === 'callerPhone' || k === 'durationSeconds' || k === 'startedAt') continue
      opts.push({ value: k, label: humanizeColumnKey(k), group: 'Call record' })
    }
    for (const k of EXTRACTED_FIELD_SORT_KEYS) {
      opts.push({ value: k, label: humanizeColumnKey(k), group: 'Retell extracted' })
    }
    for (const k of INSURANCE_VERIFICATION_SORT_KEYS) {
      opts.push({ value: k, label: humanizeColumnKey(k), group: 'Insurance' })
    }
    for (const k of customKeys) {
      opts.push({ value: makeRetellCustomSortKey(k), label: k, group: 'Retell custom' })
    }
    return opts
  }, [customKeys])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => rowMatchesFilters(r, dynamicKeys, filters))
  }, [rows, dynamicKeys, filters])

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const addColumn = () => {
    if (!pendingKey || dynamicKeys.includes(pendingKey)) return
    setDynamicKeys((k) => [...k, pendingKey])
    setPendingKey('')
  }

  const removeColumn = (key: string) => {
    setDynamicKeys((k) => k.filter((x) => x !== key))
    setFilters((f) => {
      const next = { ...f }
      delete next[key]
      return next
    })
  }

  const exportCsv = () => {
    const headers = [
      'Caller name',
      'Caller number',
      'Call duration',
      'Call time (UTC)',
      ...dynamicKeys.map(humanizeColumnKey),
    ]
    const lines = [headers.map(escapeCsv).join(',')]
    for (const row of filteredRows) {
      const dur = callDurationSeconds(row)
      const cells = [
        getCallerDisplayName(row),
        row.callerPhone || '',
        dur != null ? `${Math.round(dur)}s` : '',
        new Date(row.startedAt).toISOString(),
        ...dynamicKeys.map((k) => cellDisplay(row, k)),
      ]
      lines.push(cells.map((c) => escapeCsv(String(c))).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vantage-call-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Reporting</h2>
        {callRangeLabel ? (
          <p className="text-xs text-gray-500 mt-1">Active call date range: {callRangeLabel}</p>
        ) : null}
        <p className="text-sm text-gray-500 mt-1">
          Build your table by adding columns from Retell and CRM fields. Each column can filter rows
          (contains, case-insensitive). Caller name is derived from extracted metadata when available.
          Use the date range bar above to change which calls are loaded.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <label htmlFor="report-add-col" className="text-xs font-medium text-gray-600">
            Add column
          </label>
          <select
            id="report-add-col"
            value={pendingKey}
            onChange={(e) => setPendingKey(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 shadow-sm"
          >
            <option value="">Choose a field…</option>
            {(['Call record', 'Retell extracted', 'Insurance', 'Retell custom'] as const).map((group) => {
              const groupOpts = addableOptions.filter((o) => o.group === group)
              if (groupOpts.length === 0) return null
              return (
                <optgroup key={group} label={group}>
                  {groupOpts.map((o) => (
                    <option key={o.value} value={o.value} disabled={dynamicKeys.includes(o.value)}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>
        <Button type="button" onClick={addColumn} disabled={!pendingKey || dynamicKeys.includes(pendingKey)}>
          Add to table
        </Button>
        <Button type="button" variant="outline" onClick={exportCsv} disabled={filteredRows.length === 0}>
          Export CSV
        </Button>
        <p className="text-xs text-gray-500 lg:ml-auto">
          Showing {filteredRows.length} of {rows.length} calls (current date range)
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
            <tr className="border-b border-gray-200">
              <th className="whitespace-nowrap px-3 py-3">Caller name</th>
              <th className="whitespace-nowrap px-3 py-3">Caller number</th>
              <th className="whitespace-nowrap px-3 py-3">Call duration</th>
              <th className="whitespace-nowrap px-3 py-3">Call time</th>
              {dynamicKeys.map((key) => (
                <th key={key} className="min-w-[140px] px-3 py-2 align-top">
                  <div className="flex items-start justify-between gap-2 normal-case">
                    <span className="font-semibold text-gray-800">{humanizeColumnKey(key)}</span>
                    <button
                      type="button"
                      onClick={() => removeColumn(key)}
                      className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                      title="Remove column"
                      aria-label={`Remove column ${humanizeColumnKey(key)}`}
                    >
                      ×
                    </button>
                  </div>
                  {key === 'outcome' ? (
                    <select
                      className="mt-2 h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs font-normal normal-case text-gray-900 shadow-sm"
                      value={filters[key] ?? ''}
                      onChange={(e) => setFilter(key, e.target.value)}
                    >
                      <option value="">All outcomes</option>
                      {distinctOutcomes.map((o) => (
                        <option key={o} value={o}>
                          {o.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      className="mt-2 h-8 text-xs font-normal normal-case"
                      placeholder="Contains…"
                      value={filters[key] ?? ''}
                      onChange={(e) => setFilter(key, e.target.value)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white text-gray-900">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={4 + dynamicKeys.length} className="px-3 py-8 text-center text-gray-500">
                  No calls match the current filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => (
                <tr key={`${String(row.startedAt)}-${row.callerPhone}-${idx}`} className="hover:bg-gray-50/80">
                  <td className="max-w-[200px] truncate px-3 py-2.5 font-medium">{getCallerDisplayName(row)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">{row.callerPhone || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {formatDuration(callDurationSeconds(row))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">{callTimeLocalDisplay(row)}</td>
                  {dynamicKeys.map((key) => (
                    <td key={key} className="max-w-[220px] px-3 py-2.5 align-top text-gray-800">
                      <span className="line-clamp-3 break-words">{cellDisplay(row, key)}</span>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
