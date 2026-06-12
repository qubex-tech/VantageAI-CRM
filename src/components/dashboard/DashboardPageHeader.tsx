'use client'

import { DashboardDateRangeToggle } from '@/components/dashboard/DashboardDateRangeToggle'

interface DashboardPageHeaderProps {
  userName: string
  days: 7 | 30
  rangeLabel: string
}

export function DashboardPageHeader({ userName, days, rangeLabel }: DashboardPageHeaderProps) {
  return (
    <div className="sticky top-14 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-5 border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 truncate">
            Welcome back, {userName}
            <span className="text-gray-300 mx-2">·</span>
            <span className="text-gray-400">{rangeLabel}</span>
          </p>
        </div>
        <DashboardDateRangeToggle days={days} />
      </div>
    </div>
  )
}
