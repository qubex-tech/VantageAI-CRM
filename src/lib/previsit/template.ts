import type { HealixPreChartTemplate } from '@/lib/previsit/types'

export const DEFAULT_PREVISIT_TEMPLATE: HealixPreChartTemplate = {
  formatStyle: 'custom',
  formattingPreferences: {
    includeBulletPoints: true,
    includeICDHints: false,
    includeMedicationTable: false,
    maxSectionLength: 1200,
  },
  variants: {
    new_patient: {
      label: 'New Patient',
      smartPhrases: [],
      sections: [
        { id: 'chief_complaint', title: 'Chief Complaint', required: true },
        { id: 'history_present_illness', title: 'History of Present Illness', required: true },
        { id: 'medications_allergies', title: 'Medications & Allergies', required: true },
        { id: 'recent_labs_imaging', title: 'Recent Labs & Imaging', required: false },
        { id: 'assessment', title: 'Assessment', required: true },
        { id: 'plan', title: 'Plan', required: true },
      ],
    },
    follow_up: {
      label: 'Follow-Up',
      smartPhrases: [],
      sections: [
        { id: 'interval_history', title: 'Interval History', required: true },
        { id: 'changes_since_last_visit', title: 'Changes Since Last Visit', required: true },
        { id: 'medication_updates', title: 'Medication Updates', required: false },
        { id: 'abnormal_results', title: 'Abnormal Labs / Imaging', required: false },
        { id: 'assessment', title: 'Assessment', required: true },
        { id: 'plan', title: 'Plan', required: true },
      ],
    },
  },
}
