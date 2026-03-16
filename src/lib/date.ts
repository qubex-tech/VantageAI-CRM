import { format } from 'date-fns'

type DateInput = Date | string | null | undefined

export function normalizeDateOnly(input: DateInput): Date | null {
  if (!input) return null
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return null
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function formatDateOnly(input: DateInput, pattern: string): string {
  const normalized = normalizeDateOnly(input)
  if (!normalized) return ''
  return format(normalized, pattern)
}

export function formatDateOnlyForInput(input: DateInput): string {
  return formatDateOnly(input, 'yyyy-MM-dd')
}

export function calculateAgeFromDateOnly(input: DateInput): number {
  const birthDate = normalizeDateOnly(input)
  if (!birthDate) return 0
  const today = new Date()
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  )
  let age = todayUtc.getUTCFullYear() - birthDate.getUTCFullYear()
  const monthDiff = todayUtc.getUTCMonth() - birthDate.getUTCMonth()
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && todayUtc.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1
  }
  return age
}
