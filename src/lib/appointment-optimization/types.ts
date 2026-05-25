export const OPEN_SLOT_STATUS = {
  OPEN: 'open',
  FILLED: 'filled',
  EXHAUSTED: 'exhausted',
} as const

export const WAVE_BATCH_SIZE = 5
export const WAVE_WAIT_MS = 10 * 60 * 1000

export type OutboundAgentsSettings = {
  masterEnabled: boolean
  insuranceVerificationEnabled: boolean
  appointmentOptimizationEnabled: boolean
  /** sms | voice | prefer_sms */
  outreachChannel?: string
  /** Marketing template name for SMS body */
  smsTemplateName?: string
}

export const DEFAULT_OUTBOUND_AGENTS: OutboundAgentsSettings = {
  masterEnabled: false,
  insuranceVerificationEnabled: false,
  appointmentOptimizationEnabled: false,
  outreachChannel: 'sms',
  smsTemplateName: 'Earlier Appointment Available',
}

export type OpenSlotCreatedPayload = {
  openSlotEventId: string
  practiceId: string
  providerId: string | null
  appointmentType: string
  slotStart: string
  slotEnd: string
  durationMinutes: number
}

export type SlotWaveProcessPayload = {
  openSlotEventId: string
  practiceId: string
  waveNumber: number
}

export type SlotFillCheckPayload = {
  openSlotEventId: string
  practiceId: string
  waveNumber: number
}
