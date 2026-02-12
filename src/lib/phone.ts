export function normalizePhoneForDialing(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  if (hasPlus) {
    return `+${digits}`
  }

  // Default to US country code when 10-digit local number is provided.
  if (digits.length === 10) {
    return `+1${digits}`
  }

  // Normalize 11-digit US numbers starting with country code.
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  // Fallback to a plus-prefixed normalized number.
  return `+${digits}`
}
