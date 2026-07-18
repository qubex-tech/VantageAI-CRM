export type AriaMode = 'ambient' | 'dictation' | 'hybrid'

export type AriaSessionStatus =
  | 'recording'
  | 'uploading'
  | 'transcribing'
  | 'generating'
  | 'ready_for_review'
  | 'signed'
  | 'failed'
  | 'discarded'

export interface AriaSoapNote {
  subjective: string
  objective: string
  assessment: string
  plan: string
  addendum?: string
}

export function emptySoapNote(): AriaSoapNote {
  return {
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    addendum: '',
  }
}

export function formatSoapAsText(soap: AriaSoapNote): string {
  const sections = [
    ['SUBJECTIVE', soap.subjective],
    ['OBJECTIVE', soap.objective],
    ['ASSESSMENT', soap.assessment],
    ['PLAN', soap.plan],
  ] as const

  const body = sections
    .map(([label, text]) => `${label}\n${(text || '').trim() || '—'}`)
    .join('\n\n')

  const addendum = (soap.addendum || '').trim()
  if (!addendum) return body
  return `${body}\n\nADDENDUM\n${addendum}`
}

export function parseSoapJson(value: unknown): AriaSoapNote {
  if (!value || typeof value !== 'object') return emptySoapNote()
  const v = value as Record<string, unknown>
  return {
    subjective: typeof v.subjective === 'string' ? v.subjective : '',
    objective: typeof v.objective === 'string' ? v.objective : '',
    assessment: typeof v.assessment === 'string' ? v.assessment : '',
    plan: typeof v.plan === 'string' ? v.plan : '',
    addendum: typeof v.addendum === 'string' ? v.addendum : '',
  }
}
