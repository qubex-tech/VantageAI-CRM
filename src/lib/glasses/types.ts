export type GlassesCardId = 'glance' | 'alerts' | 'lastVisit'

export type GlassesCard = {
  id: GlassesCardId
  title: string
  lines: [string, string, string]
}

export type GlassesSnippet = {
  label: string
  text: string
}

export type GlassesNote = {
  type: string
  content: string
  createdAt?: Date | string | null
}

export type GlassesChartInput = {
  patientName: string
  dateOfBirth?: Date | string | null
  visitType?: string | null
  reason?: string | null
  appointmentStart?: Date | string | null
  timeZone?: string | null
  notes?: GlassesNote[]
  snippets?: GlassesSnippet[]
  tags?: string[]
  now?: Date
}

export type GlassesAskModel = 'local' | 'openai' | 'muse'

export const GLASSES_DEMO_PATIENT_ID = 'demo'
export const GLASSES_LINE_WIDTH = 42
export const GLASSES_ANSWER_WIDTH = 80
