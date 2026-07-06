export function formatSlotDate(slotStart: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(slotStart)
}

export function formatSlotTime(slotStart: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(slotStart)
}

export function formatSlotDateTime(slotStart: Date, timezone: string) {
  return `${formatSlotDate(slotStart, timezone)} at ${formatSlotTime(slotStart, timezone)}`
}
