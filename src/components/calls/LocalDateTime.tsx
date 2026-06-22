'use client'

import { UserDateTime } from '@/components/ui/UserDateTime'

interface LocalDateTimeProps {
  timestamp: number
  className?: string
}

/** @deprecated Prefer UserDateTime — kept for call detail pages. */
export function LocalDateTime({ timestamp, className }: LocalDateTimeProps) {
  return <UserDateTime value={timestamp} className={className} />
}
