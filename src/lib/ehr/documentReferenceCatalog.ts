/**
 * eCW DocumentReference semantics (US Core) per eClinicalWorks API guides:
 * - Insurance card & government ID uploads share category "clinical-note" and are distinguished by LOINC type.
 * - Clinical notes use http://loinc.org type codes below with the same US Core category.
 * - Patient summary / type-filter examples in the clinical-notes guide use additional LOINC codes (e.g. 34133-9).
 */

export const ECW_INSURANCE_OR_ID_LOINC = new Set(['64290-0', '53245-7'])

export const ECW_CLINICAL_NOTE_LOINC = new Set([
  '11488-4', // Consultation note
  '34117-2', // H & P note
  '28570-0', // Procedure note
  '11506-3', // Progress note
  '18842-5', // Discharge summary
  '18748-4', // Imaging narrative
  '11502-2', // Laboratory report narrative
  '11526-1', // Pathology report narrative
])

/** Summary / C-CDA-style documents referenced in eCW search examples */
export const ECW_SUMMARY_LOINC = new Set(['34133-9'])

export type DocumentationBucket = 'insurance_and_id' | 'clinical_notes' | 'summaries' | 'other'

export function bucketForDocumentReference(doc: {
  type?: { coding?: Array<{ system?: string; code?: string }> }
  category?: Array<{ coding?: Array<{ code?: string }> }>
}): DocumentationBucket {
  const codings = doc.type?.coding || []
  const loincCodes = codings
    .filter((c) => !c.system || c.system === 'http://loinc.org')
    .map((c) => (c.code || '').trim())
    .filter(Boolean)

  for (const code of loincCodes) {
    if (ECW_INSURANCE_OR_ID_LOINC.has(code)) return 'insurance_and_id'
  }
  for (const code of loincCodes) {
    if (ECW_SUMMARY_LOINC.has(code)) return 'summaries'
  }
  for (const code of loincCodes) {
    if (ECW_CLINICAL_NOTE_LOINC.has(code)) return 'clinical_notes'
  }

  const categoryCodes = (doc.category || [])
    .flatMap((cat) => (cat.coding || []).map((c) => c.code))
    .filter(Boolean)

  if (categoryCodes.includes('clinical-note')) {
    return 'clinical_notes'
  }

  return 'other'
}

export function primaryTypeLabel(doc: {
  type?: { text?: string; coding?: Array<{ display?: string; code?: string }> }
}): string {
  if (doc.type?.text?.trim()) return doc.type.text.trim()
  const c = doc.type?.coding?.[0]
  if (c?.display?.trim()) return c.display.trim()
  if (c?.code) return c.code
  return 'Document'
}
