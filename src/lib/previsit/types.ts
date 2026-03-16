export type PreVisitChartType = 'new_patient' | 'follow_up'

export interface PreVisitTemplateSection {
  id: string
  title: string
  guidance?: string
  required?: boolean
}

export interface PreVisitTemplateVariant {
  label: string
  sections: PreVisitTemplateSection[]
  smartPhrases: string[]
}

export interface HealixPreChartTemplate {
  formatStyle?: 'soap' | 'narrative' | 'problem_oriented' | 'custom'
  formattingPreferences?: {
    includeBulletPoints?: boolean
    includeICDHints?: boolean
    includeMedicationTable?: boolean
    maxSectionLength?: number
  }
  variants: Record<PreVisitChartType, PreVisitTemplateVariant>
}

export interface PreVisitEvidenceLocator {
  patientId?: string
  noteId?: string
  timelineEntryId?: string
  appointmentId?: string
  formSubmissionId?: string
  documentUploadId?: string
  kbId?: string
  page?: number
}

export interface PreVisitEvidenceItem {
  sourceId: string
  sourceType:
    | 'patient_profile'
    | 'patient_note'
    | 'timeline_entry'
    | 'appointment'
    | 'insurance'
    | 'form_submission'
    | 'document_upload'
    | 'knowledge_base'
  title: string
  snippet: string
  locator?: PreVisitEvidenceLocator
}

export interface PreVisitChartReference {
  number: number
  sourceId: string
}

export interface PreVisitChartSectionOutput {
  id: string
  title: string
  content: string
  references: PreVisitChartReference[]
}
