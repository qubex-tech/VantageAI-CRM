import type { ExtractedCallData } from '@/lib/process-call-data'

/** True when the value is primarily a phone number (not a human name). */
export function looksLikePhoneNumber(value: string | null | undefined): boolean {
  if (!value?.trim()) return false
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 7) return false
  const letters = trimmed.replace(/[^A-Za-z]/g, '')
  if (letters.length >= 3 && !/^\+?\d/.test(trimmed)) return false
  return /^[\d+\-().\s]+$/.test(trimmed) || (digits.length >= 10 && letters.length <= 2)
}

/** CRM / eCW placeholder phones must not drive patient matching. */
export function isPlaceholderPhone(value: string | null | undefined): boolean {
  if (!value?.trim()) return true
  const digits = value.replace(/\D/g, '')
  return !digits || /^0+$/.test(digits)
}

function isHumanNamePart(part: string): boolean {
  const trimmed = part.trim()
  if (!trimmed || looksLikePhoneNumber(trimmed) || /^the caller\b/i.test(trimmed)) return false
  return /[A-Za-z]/.test(trimmed) && trimmed.replace(/[^A-Za-z]/g, '').length >= 2
}

/**
 * Retell must supply a real patient identity (first/last or a human name).
 * Shared inbound ANI / callback numbers are never sufficient.
 */
export function hasExplicitRetellPatientIdentity(extractedData: ExtractedCallData): boolean {
  const custom = (extractedData.retell_custom_data || {}) as Record<string, unknown>
  const first = String(custom['Patient First Name'] ?? custom['patient_first_name'] ?? '').trim()
  const last = String(custom['Patient Last Name'] ?? custom['patient_last_name'] ?? '').trim()
  if (isHumanNamePart(first) || isHumanNamePart(last)) return true

  const name = (extractedData.patient_name || '').trim()
  if (!name || looksLikePhoneNumber(name) || /^the caller\b/i.test(name)) return false
  const parts = name.split(/\s+/).filter(Boolean)
  return parts.some((part) => isHumanNamePart(part))
}

/** Name to use for eCW Patient search when identity is explicit; null otherwise. */
export function resolveExplicitPatientNameForEhrLookup(
  extractedData: ExtractedCallData,
  crmPatientName?: string | null
): string | null {
  if (!hasExplicitRetellPatientIdentity(extractedData)) return null

  const custom = (extractedData.retell_custom_data || {}) as Record<string, unknown>
  const first = String(custom['Patient First Name'] ?? custom['patient_first_name'] ?? '').trim()
  const last = String(custom['Patient Last Name'] ?? custom['patient_last_name'] ?? '').trim()
  if (isHumanNamePart(first) || isHumanNamePart(last)) {
    return `${first} ${last}`.trim()
  }

  const extractedName = (extractedData.patient_name || '').trim()
  if (extractedName && !looksLikePhoneNumber(extractedName)) return extractedName

  if (crmPatientName && !looksLikePhoneNumber(crmPatientName)) return crmPatientName.trim()
  return null
}

/** Patient-stated phone only; never ANI/callback or placeholder CRM phones. */
export function resolvePatientStatedPhoneForEhrLookup(
  extractedData: ExtractedCallData
): string | null {
  const phone = extractedData.patient_phone_number?.trim()
  if (!phone || isPlaceholderPhone(phone)) return null
  return phone
}
