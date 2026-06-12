'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Pulls missing Retell calls into the CRM after the dashboard paints.
 * Does not block initial render.
 */
export function DashboardBackgroundSync() {
  const router = useRouter()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const controller = new AbortController()

    void fetch('/api/dashboard/sync-calls', {
      method: 'POST',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return null
        return res.json() as Promise<{ imported?: number }>
      })
      .then((data) => {
        if (data?.imported && data.imported > 0) {
          router.refresh()
        }
      })
      .catch(() => {})

    return () => controller.abort()
  }, [router])

  return null
}
