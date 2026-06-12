'use client'

interface DashboardPageHeaderProps {
  userName: string
  rangeLabel: string
}

export function DashboardPageHeader({ userName, rangeLabel }: DashboardPageHeaderProps) {
  return (
    <p className="pt-5 mb-5 text-sm text-gray-500">
      Welcome back, {userName}
      <span className="text-gray-300 mx-2">·</span>
      <span className="text-gray-400">{rangeLabel}</span>
    </p>
  )
}
