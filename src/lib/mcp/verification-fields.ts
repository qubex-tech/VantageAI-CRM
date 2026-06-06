/**
 * Canonical field names for the insurance verification voice agent (Retell {{var}} templates).
 */
export interface VerificationAgentFields {
  patient_first_name: string
  patient_last_name: string
  /** YYYY-MM-DD */
  patient_dob: string
  member_id: string
  group_number: string
}

export function formatPatientDob(value: Date | string | null | undefined): string {
  if (value == null || value === '') return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return value.toISOString().slice(0, 10)
  }
  const trimmed = String(value).trim()
  if (!trimmed) return ''
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return trimmed
}

export function buildVerificationAgentFields(params: {
  firstName?: string | null
  lastName?: string | null
  dateOfBirth?: Date | string | null
  memberId?: string | null
  groupNumber?: string | null
}): VerificationAgentFields {
  return {
    patient_first_name: params.firstName?.trim() || '',
    patient_last_name: params.lastName?.trim() || '',
    patient_dob: formatPatientDob(params.dateOfBirth),
    member_id: params.memberId?.trim() || '',
    group_number: params.groupNumber?.trim() || '',
  }
}
