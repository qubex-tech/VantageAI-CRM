'use client'

import { DashboardDateRangeToggle } from '@/components/dashboard/DashboardDateRangeToggle'

interface DashboardPageHeaderProps {
  userName: string
  days: 7 | 30
  rangeLabel: string
  onDaysChange: (days: 7 | 30) => void
}

export function DashboardPageHeader({
  userName,
  days,
  rangeLabel,
  onDaysChange,
}: DashboardPageHeaderProps) {
  return (
    <div className="mb-6 pb-4 border-b border-gray-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 truncate">
            Welcome back, {userName}
            <span className="text-gray-300 mx-2">·</span>
            <span className="text-gray-400">{rangeLabel}</span>
          </p>
        </div>
        <DashboardDateRangeToggle days={days} onDaysChange={onDaysChange} />
      </div>
    </div>
  )
}
