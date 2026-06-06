import {
  type PatientNoteType,
  PATIENT_NOTE_TYPES,
  PATIENT_NOTE_TYPE_LABELS,
} from '@/lib/patient-note-types'

export type EhrPatientNoteSyncMode = 'none' | 'telephone_encounter' | 'document_reference'

export type EhrPatientNoteSyncByType = Partial<Record<PatientNoteType, EhrPatientNoteSyncMode>>

/** Default: encounter visit types → telephone encounter; all others → CRM only. */
export const DEFAULT_EHR_PATIENT_NOTE_SYNC_BY_TYPE: EhrPatientNoteSyncByType = {
  telephone_encounter: 'telephone_encounter',
  online_visit: 'telephone_encounter',
  onsite_visit: 'telephone_encounter',
}

export function resolveEhrSyncModeForNoteType(
  syncByType: EhrPatientNoteSyncByType | null | undefined,
  noteType: PatientNoteType
): EhrPatientNoteSyncMode {
  const configured = syncByType?.[noteType]
  if (configured) return configured
  return DEFAULT_EHR_PATIENT_NOTE_SYNC_BY_TYPE[noteType] ?? 'none'
}

export const EHR_PATIENT_NOTE_SYNC_MODE_LABELS: Record<EhrPatientNoteSyncMode, string> = {
  none: 'Vantage only (no eCW write)',
  telephone_encounter: 'eCW Telephone Encounter',
  document_reference: 'eCW DocumentReference (clinical note)',
}

export { PATIENT_NOTE_TYPES, PATIENT_NOTE_TYPE_LABELS }
