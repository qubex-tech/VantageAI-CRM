'use client'

import { useEffect, useState } from 'react'
import { formatUserFacingDateTime, type UserFacingDateTimeOptions } from '@/lib/timezone'

export type UserDateTimeProps = {
  value: string | number | Date
  className?: string
  dateOnly?: boolean
  /** Optional override; omit to use the viewer's browser timezone. */
  timeZone?: string
}

/**
 * Renders a timestamp in the user's local timezone (client-only formatting).
 */
export function UserDateTime({ value, className, dateOnly, timeZone }: UserDateTimeProps) {
  const [formatted, setFormatted] = useState<string>('...')

  useEffect(() => {
    const options: UserFacingDateTimeOptions = { dateOnly, timeZone }
    setFormatted(formatUserFacingDateTime(value, options))
  }, [value, dateOnly, timeZone])

  return (
    <span className={className} suppressHydrationWarning>
      {formatted}
    </span>
  )
}
