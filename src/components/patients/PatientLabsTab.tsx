'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, FlaskConical, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LabFlag, LabOrder, LabPanel, LabResultRow } from '@/lib/ehr/ecwPatientLabs'

type LabsResponse =
  | {
      configured: false
      message: string
      panels: LabPanel[]
      orders: LabOrder[]
    }
  | {
      configured: true
      patientLinked: false
      message: string
      panels: LabPanel[]
      orders: LabOrder[]
    }
  | {
      configured: true
      patientLinked: true
      panels: LabPanel[]
      orders: LabOrder[]
    }

function formatLabDate(value?: string | null, withTime = false): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  }).format(date)
}

function flagClass(flag: LabFlag): string {
  if (flag === 'H') return 'text-red-600 font-semibold'
  if (flag === 'L') return 'text-blue-700 font-semibold'
  return 'text-gray-900'
}

export function PatientLabsTab({ patientId }: { patientId: string }) {
  const [data, setData] = useState<LabsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [panelKey, setPanelKey] = useState<string>('')
  const [innerTab, setInnerTab] = useState<'results' | 'orders' | 'graph'>('results')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/patients/${patientId}/labs`, { cache: 'no-store' })
      const json = (await response.json()) as LabsResponse & { error?: string }
      if (!response.ok) throw new Error(json.error || 'Failed to load labs')
      setData(json)
      const firstPanel = json.panels?.[0]?.key
      if (firstPanel) setPanelKey((current) => current || firstPanel)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load labs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [patientId])

  const panel = useMemo(
    () => data?.panels.find((item) => item.key === panelKey) || data?.panels[0] || null,
    [data, panelKey]
  )

  useEffect(() => {
    if (!panel?.rows.length) {
      setSelectedKey(null)
      return
    }
    const preferred = panel.rows.find((row) => !row.futureOrder) || panel.rows[0]
    setSelectedKey(preferred.key)
  }, [panel?.key, panel?.rows])

  const selected = panel?.rows.find((row) => row.key === selectedKey) || panel?.rows[0] || null

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading labs from eCW…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div>{error}</div>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!data || !data.configured || ('patientLinked' in data && data.patientLinked === false)) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {data && 'message' in data && data.message ? data.message : 'Labs are not available for this patient.'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">Labs</h2>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh from eCW
        </Button>
      </div>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-xs text-gray-600">
            Lab type
            <select
              className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
              value={panel?.key || ''}
              onChange={(event) => setPanelKey(event.target.value)}
            >
              {(data.panels || []).map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs text-gray-600">
            Status
            <div className="mt-1 text-sm font-medium text-gray-900">{selected?.status || '—'}</div>
          </div>
          <div className="text-xs text-gray-600">
            Future order
            <div className="mt-1 text-sm font-medium text-gray-900">{selected?.futureOrder ? 'Yes' : 'No'}</div>
          </div>
          <div className="text-xs text-gray-600">
            Ordered on
            <div className="mt-1 text-sm font-medium text-gray-900">{formatLabDate(selected?.authoredOn)}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={Boolean(selected?.resultDate)} readOnly className="rounded border-gray-300" />
            Received
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={Boolean(selected?.resultDate)} readOnly className="rounded border-gray-300" />
            Result date
          </label>
          <span>
            Reviewed as{' '}
            <span className="font-medium text-gray-900">{selected?.status || '—'}</span>
          </span>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200">
        {(
          [
            ['results', 'Results'],
            ['orders', 'Order & Collection'],
            ['graph', 'Graph'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setInnerTab(id)}
            className={`px-1 py-2 text-sm font-medium border-b-2 ${
              innerTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {innerTab === 'results' && !panel && (
        <div className="py-10 text-center text-sm text-gray-500">No laboratory results found in eCW.</div>
      )}

      {innerTab === 'results' && panel && (
        <ResultsGrid
          panel={panel}
          selectedKey={selected?.key || null}
          onSelect={setSelectedKey}
        />
      )}

      {innerTab === 'orders' && (
        <OrdersTable
          orders={(data.orders || []).filter((order) => !panel || order.panelKey === panel.key)}
        />
      )}

      {innerTab === 'graph' && panel && <GraphPanel key={panel.key} panel={panel} />}
    </div>
  )
}

function ResultsGrid({
  panel,
  selectedKey,
  onSelect,
}: {
  panel: LabPanel
  selectedKey: string | null
  onSelect: (key: string) => void
}) {
  const selected = panel.rows.find((row) => row.key === selectedKey) || panel.rows[0]
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-6 text-sm">
        <div>
          <div className="text-xs text-gray-500">Result date</div>
          <div className="font-medium text-gray-900">{formatLabDate(selected?.resultDate)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Collection date & time</div>
          <div className="font-medium text-gray-900">{formatLabDate(selected?.collectionDateTime, true)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Order date</div>
          <div className="font-medium text-gray-900">{formatLabDate(selected?.orderDate)}</div>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-full text-xs">
          <thead className="bg-blue-50 text-gray-700">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Order Date</th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Collection Date & Time</th>
              {panel.columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {panel.rows.map((row) => (
              <ResultRow
                key={row.key}
                row={row}
                columns={panel.columns}
                selected={row.key === selected?.key}
                onSelect={() => onSelect(row.key)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ResultRow({
  row,
  columns,
  selected,
  onSelect,
}: {
  row: LabResultRow
  columns: LabPanel['columns']
  selected: boolean
  onSelect: () => void
}) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-t border-gray-100 ${selected ? 'bg-amber-100' : 'hover:bg-gray-50'}`}
    >
      <td className="whitespace-nowrap px-3 py-2 text-gray-900">{formatLabDate(row.orderDate)}</td>
      <td className="whitespace-nowrap px-3 py-2 text-gray-900">
        {row.futureOrder ? '—' : formatLabDate(row.collectionDateTime, true)}
      </td>
      {columns.map((column) => {
        const cell = row.values[column.key]
        return (
          <td key={column.key} className={`whitespace-nowrap px-3 py-2 ${flagClass(cell?.interpretation || null)}`}>
            {cell?.value || (row.futureOrder ? '' : '—')}
          </td>
        )
      })}
    </tr>
  )
}

function OrdersTable({ orders }: { orders: LabOrder[] }) {
  if (!orders.length) {
    return <div className="py-10 text-center text-sm text-gray-500">No orders found for this lab type.</div>
  }
  return (
    <div className="overflow-x-auto rounded-md border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-700">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Lab</th>
            <th className="px-3 py-2 text-left font-medium">Order date</th>
            <th className="px-3 py-2 text-left font-medium">Ordered on</th>
            <th className="px-3 py-2 text-left font-medium">Collection</th>
            <th className="px-3 py-2 text-left font-medium">Received</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-gray-100">
              <td className="px-3 py-2">{order.panelLabel}</td>
              <td className="px-3 py-2">{formatLabDate(order.orderDate)}</td>
              <td className="px-3 py-2">{formatLabDate(order.authoredOn)}</td>
              <td className="px-3 py-2">{formatLabDate(order.collectionDateTime, true)}</td>
              <td className="px-3 py-2">{formatLabDate(order.resultDate)}</td>
              <td className="px-3 py-2">{order.reviewStatus || order.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GraphPanel({ panel }: { panel: LabPanel }) {
  const [columnKey, setColumnKey] = useState(panel.columns[0]?.key || '')
  const points = panel.rows
    .filter((row) => !row.futureOrder)
    .map((row) => {
      const raw = row.values[columnKey]?.value || ''
      const num = parseFloat(raw.replace(/[^0-9.-]/g, ''))
      return {
        label: formatLabDate(row.collectionDateTime),
        value: Number.isFinite(num) ? num : null,
        flag: row.values[columnKey]?.interpretation || null,
      }
    })
    .filter((point) => point.value !== null)
    .reverse()

  const values = points.map((point) => point.value as number)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 1
  const span = max - min || 1

  return (
    <div className="space-y-3">
      <label className="text-xs text-gray-600">
        Analyte
        <select
          className="ml-2 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          value={columnKey}
          onChange={(event) => setColumnKey(event.target.value)}
        >
          {panel.columns.map((column) => (
            <option key={column.key} value={column.key}>
              {column.label}
            </option>
          ))}
        </select>
      </label>
      {points.length < 2 ? (
        <div className="py-10 text-center text-sm text-gray-500">Not enough numeric results to graph.</div>
      ) : (
        <svg viewBox="0 0 640 220" className="w-full rounded-md border border-gray-200 bg-white">
          <text x="12" y="20" className="fill-gray-500" fontSize="11">
            {panel.columns.find((column) => column.key === columnKey)?.label} · eCW laboratory observations
          </text>
          {points.map((point, index) => {
            const x = 40 + (index * 560) / Math.max(points.length - 1, 1)
            const y = 180 - ((point.value! - min) / span) * 140
            const next = points[index + 1]
            const nx = next ? 40 + ((index + 1) * 560) / Math.max(points.length - 1, 1) : x
            const ny = next ? 180 - ((next.value! - min) / span) * 140 : y
            return (
              <g key={`${point.label}-${index}`}>
                {next && <line x1={x} y1={y} x2={nx} y2={ny} stroke="#2563eb" strokeWidth="2" />}
                <circle cx={x} cy={y} r="4" fill={point.flag === 'H' ? '#dc2626' : '#2563eb'} />
                <text x={x} y="208" textAnchor="middle" fontSize="10" fill="#6b7280">
                  {point.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
