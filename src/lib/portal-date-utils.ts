/**
 * Portal Date Utilities
 * Helper functions for formatting dates/times in the patient portal
 * with proper timezone handling
 */

/**
 * Format a date/time in a specific timezone
 * @param date - The date to format (can be Date or ISO string)
 * @param timezone - IANA timezone string (e.g., 'America/New_York')
 * @param options - Intl.DateTimeFormatOptions
 */
export function formatInTimezone(
  date: Date | string,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  // Fallback to UTC if timezone is missing or invalid
  const validTimezone = timezone && timezone.trim() ? timezone : 'UTC'
  
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: validTimezone,
      ...options,
    }).format(dateObj)
  } catch (e) {
    // If timezone is invalid, fallback to UTC
    console.warn(`Invalid timezone "${timezone}", falling back to UTC`)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      ...options,
    }).format(dateObj)
  }
}

/**
 * Format appointment date (e.g., "Monday, January 26, 2026")
 */
export function formatAppointmentDate(
  date: Date | string,
  timezone: string
): string {
  return formatInTimezone(date, timezone, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format appointment time (e.g., "4:30 PM")
 */
export function formatAppointmentTime(
  date: Date | string,
  timezone: string
): string {
  return formatInTimezone(date, timezone, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Format appointment date and time range
 * @param startTime - Start time
 * @param endTime - End time
 * @param timezone - IANA timezone string
 */
export function formatAppointmentTimeRange(
  startTime: Date | string,
  endTime: Date | string,
  timezone: string
): string {
  const start = formatAppointmentTime(startTime, timezone)
  const end = formatAppointmentTime(endTime, timezone)
  return `${start} - ${end}`
}
