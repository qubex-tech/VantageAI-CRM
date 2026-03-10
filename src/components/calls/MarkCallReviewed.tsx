'use client'

import { useEffect } from 'react'

/**
 * On mount, marks the current call as reviewed so it shows as "read" in the Calls list.
 * Call this once when the call detail page is viewed.
 */
export function MarkCallReviewed({ callId }: { callId: string }) {
  useEffect(() => {
    if (!callId) return
    fetch(`/api/calls/${encodeURIComponent(callId)}/review`, { method: 'POST' }).catch(() => {})
  }, [callId])
  return null
}
