'use client'

import { cn } from '@/lib/utils'

interface DashboardDateRangeToggleProps {
  days: 7 | 30
  onDaysChange: (days: 7 | 30) => void
}

export function DashboardDateRangeToggle({ days, onDaysChange }: DashboardDateRangeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1 shadow-sm shrink-0">
      <button
        type="button"
        onClick={() => onDaysChange(7)}
        className={cn(
          'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          days === 7
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        )}
      >
        7 days
      </button>
      <button
        type="button"
        onClick={() => onDaysChange(30)}
        className={cn(
          'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          days === 30
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        )}
      >
        30 days
      </button>
    </div>
  )
}
