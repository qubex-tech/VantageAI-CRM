'use client'

import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'

export function DashboardMetricsSkeleton({ userName = 'there' }: { userName?: string }) {
  return (
    <>
      <DashboardPageHeader userName={userName} rangeLabel="Loading recent activity…" />

      <div className="mb-6 h-40 rounded-xl border border-gray-100 bg-white shadow-lg shadow-gray-200/50 animate-pulse" />

      <div className="grid gap-5 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-100 bg-white p-6 shadow-lg shadow-gray-200/50 animate-pulse"
          >
            <div className="mb-4 h-4 w-28 rounded bg-gray-200" />
            <div className="mb-2 h-10 w-16 rounded bg-gray-200" />
            <div className="h-3 w-36 rounded bg-gray-100" />
          </div>
        ))}
      </div>

      <section className="mt-8">
        <div className="mb-4 space-y-2">
          <div className="h-5 w-32 rounded bg-gray-200 animate-pulse" />
          <div className="h-4 w-48 rounded bg-gray-100 animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-100 bg-white p-5 shadow-lg shadow-gray-200/50 animate-pulse"
            >
              <div className="mb-3 h-4 w-40 rounded bg-gray-200" />
              <div className="mb-2 h-4 w-full rounded bg-gray-100" />
              <div className="h-4 w-2/3 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
