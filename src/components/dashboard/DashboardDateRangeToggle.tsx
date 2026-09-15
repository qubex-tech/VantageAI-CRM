'use client'

import { cn } from '@/lib/utils'
import type { DashboardRangeKey } from '@/lib/analytics/dashboardDateRange'

const OPTIONS: { value: DashboardRangeKey; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
]

interface DashboardDateRangeToggleProps {
  range: DashboardRangeKey
  onRangeChange: (range: DashboardRangeKey) => void
}

export function DashboardDateRangeToggle({
  range,
  onRangeChange,
}: DashboardDateRangeToggleProps) {
  return (
    <div className="inline-flex flex-wrap items-center rounded-lg border border-gray-200 bg-gray-50 p-1 shadow-sm shrink-0">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onRangeChange(option.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            range === option.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
