'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface DashboardDateRangeToggleProps {
  days: 7 | 30
}

export function DashboardDateRangeToggle({ days }: DashboardDateRangeToggleProps) {
  const router = useRouter()

  const setDays = (value: 7 | 30) => {
    if (value === days) return
    router.push(value === 7 ? '/dashboard' : '/dashboard?days=30')
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1 shadow-sm">
      <button
        type="button"
        onClick={() => setDays(7)}
        className={cn(
          'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
          days === 7
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        )}
      >
        7 days
      </button>
      <button
        type="button"
        onClick={() => setDays(30)}
        className={cn(
          'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
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
