'use client'

import { useEffect, useState } from 'react'

interface LocalDateTimeProps {
  timestamp: number
  className?: string
}

export function LocalDateTime({ timestamp, className }: LocalDateTimeProps) {
  const [formatted, setFormatted] = useState<string>('...')

  useEffect(() => {
    const date = new Date(timestamp)
    const display = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date)
    setFormatted(display)
  }, [timestamp])

  return (
    <span className={className} suppressHydrationWarning>
      {formatted}
    </span>
  )
}
