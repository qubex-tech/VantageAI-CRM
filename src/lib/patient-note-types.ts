/** Vantage CRM patient profile note types (stored in PatientNote.type). */
export const PATIENT_NOTE_TYPES = [
  'general',
  'medical',
  'administrative',
  'billing',
  'appointment',
  'medication',
  'allergy',
  'contact',
  'insurance',
  'telephone_encounter',
  'online_visit',
  'onsite_visit',
  'other',
] as const

export type PatientNoteType = (typeof PATIENT_NOTE_TYPES)[number]

export const PATIENT_NOTE_TYPE_LABELS: Record<PatientNoteType, string> = {
  general: 'General',
  medical: 'Medical',
  administrative: 'Administrative',
  billing: 'Billing',
  appointment: 'Appointment',
  medication: 'Medication',
  allergy: 'Allergy',
  contact: 'Contact',
  insurance: 'Insurance',
  telephone_encounter: 'Telephone Encounter Notes',
  online_visit: 'Online Visit Notes',
  onsite_visit: 'Onsite Visit Notes',
  other: 'Other',
}

export function isPatientNoteType(value: string): value is PatientNoteType {
  return (PATIENT_NOTE_TYPES as readonly string[]).includes(value)
}

export function formatPatientNoteForEhr(type: PatientNoteType, content: string): string {
  const label = PATIENT_NOTE_TYPE_LABELS[type] || 'Note'
  return `${label}\n\n${content}`
}
