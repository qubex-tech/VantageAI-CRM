export const OPEN_SLOT_STATUS = {
  OPEN: 'open',
  FILLED: 'filled',
  EXHAUSTED: 'exhausted',
} as const

export const WAVE_BATCH_SIZE = 5
/** Default minutes between outreach waves when settings omit waveIntervalMinutes. */
export const DEFAULT_WAVE_INTERVAL_MINUTES = 10
export const WAVE_WAIT_MS = DEFAULT_WAVE_INTERVAL_MINUTES * 60 * 1000

/** Scenarios that can create an open slot and start outreach. */
export type OpenSlotTriggerScenario = 'cancellation' | 'noShow' | 'reschedule' | 'availability'

export type OpenSlotTriggerScenarios = Record<OpenSlotTriggerScenario, boolean>

export const DEFAULT_TRIGGER_SCENARIOS: OpenSlotTriggerScenarios = {
  cancellation: true,
  noShow: false,
  reschedule: false,
  availability: false,
}

export const OPEN_SLOT_TRIGGER_SCENARIO_OPTIONS: Array<{
  key: OpenSlotTriggerScenario
  label: string
  description: string
}> = [
  {
    key: 'cancellation',
    label: 'Appointment cancellation',
    description:
      'When an appointment is cancelled in the CRM, patient portal, Cal.com, eClinicalWorks, Open Dental, or any connected system.',
  },
  {
    key: 'noShow',
    label: 'Patient no-show',
    description:
      'When an appointment is marked no-show in the CRM or synced from a connected EHR/EMR.',
  },
  {
    key: 'reschedule',
    label: 'Reschedule frees a slot',
    description:
      'When a visit is moved to a new time in any connected system, contact patients about the earlier time that was freed.',
  },
  {
    key: 'availability',
    label: 'Open schedule time',
    description:
      'When a blank opening is detected on the provider schedule from any connected EHR/EMR or availability feed.',
  },
]

export type OpenSlotSource = 'cancellation' | 'no_show' | 'reschedule' | 'availability'

export const SCENARIO_TO_SOURCE: Record<OpenSlotTriggerScenario, OpenSlotSource> = {
  cancellation: 'cancellation',
  noShow: 'no_show',
  reschedule: 'reschedule',
  availability: 'availability',
}

/** Human-readable labels for automation conditions on Slot Available. */
export const OPEN_SLOT_SOURCE_LABELS: Record<OpenSlotSource, string> = {
  cancellation: 'Patient canceled',
  no_show: 'Patient no show',
  reschedule: 'Reschedule frees up a time slot',
  availability: 'Open slot available',
}

/**
 * immediate — built-in waves start as soon as the open slot is created (can be midnight sync).
 * automation — emit crm/open_slot.available and let workflow automations control timing + channel.
 */
export type SlotFillOutreachMode = 'immediate' | 'automation'

/** Normalized open time slot — input to the rules engine. Source is opaque metadata only. */
export type OpenTimeSlotOriginSystem =
  | 'crm'
  | 'ecw'
  | 'opendental'
  | 'calcom'
  | 'manual'
  | 'unknown'

export type OpenTimeSlot = {
  start: Date
  end: Date
  visitType: string
  providerId: string | null
  practiceId: string
  /** Maps to OpenSlotEvent.source when outreach starts */
  openSlotSource?: OpenSlotSource
  sourceAppointmentId?: string | null
  /** Set when loaded from open_slot_inventory */
  inventoryId?: string
  origin?: {
    system: OpenTimeSlotOriginSystem
    externalId?: string | null
  }
}

export type SlotFillRule = {
  id: string
  visitType: string
  bufferBusinessDays: number
  /**
   * First calendar day after the open slot when patients become eligible.
   * Example: 7 with slot Jul 10 → start engaging patients booked on/after Jul 17.
   */
  lookAheadStartBusinessDays: number
  /**
   * Last calendar day after the open slot when patients are still eligible.
   * Example: 14 with slot Jul 10 → stop engaging patients booked after Jul 24.
   */
  lookAheadEndBusinessDays: number
  /**
   * @deprecated Prefer lookAheadEndBusinessDays. Kept for older saved settings.
   */
  lookAheadBusinessDays?: number
  enabled?: boolean
}

export const MAX_SLOT_FILL_RULES = 20

export const DEFAULT_SLOT_FILL_RULE: Omit<SlotFillRule, 'id' | 'visitType'> = {
  bufferBusinessDays: 3,
  lookAheadStartBusinessDays: 7,
  lookAheadEndBusinessDays: 14,
  enabled: true,
}

export type OpenSlotEventMetadata = {
  slotFillRuleId: string
  lookAheadStart: string
  lookAheadEnd: string
  bufferBusinessDays: number
  lookAheadStartBusinessDays: number
  lookAheadEndBusinessDays: number
}

/** How inbound SMS replies to slot-fill offers are handled. */
export type SmsReplyHandling = 'telnyx_inbound' | 'practice_number'

export type SlotFillReplyIntent =
  | 'accept_earlier_slot'
  | 'decline'
  | 'question'
  | 'unrelated'
  | 'unclear'

export type OutboundAgentsSettings = {
  masterEnabled: boolean
  insuranceVerificationEnabled: boolean
  appointmentOptimizationEnabled: boolean
  /** sms | voice | prefer_sms | prefer_voice | curogram_sms */
  outreachChannel?: string
  /** Marketing template name for SMS body */
  smsTemplateName?: string
  /** Curogram template display name used for admin identification */
  curogramSmsTemplateName?: string
  /** Curogram action ID used when outreach channel is curogram_sms */
  curogramSmsActionId?: string
  /**
   * telnyx_inbound — replies route to Vantage Telnyx webhook (auto book on accept).
   * practice_number — staff/Curogram (or practice number) handle replies; no auto-book.
   */
  smsReplyHandling?: SmsReplyHandling
  /** Which events create open slots and start the optimization agent */
  triggerScenarios?: OpenSlotTriggerScenarios
  /** Minutes to wait between outreach waves (default 10). */
  waveIntervalMinutes?: number
  /**
   * immediate — built-in Inngest waves send right away.
   * automation — workflows handle wait-until + Curogram/SMS via Slot Available trigger.
   */
  slotFillOutreachMode?: SlotFillOutreachMode
  /** Per-visit-type buffer / look-ahead rules for proactive and inventory-based slot fill */
  slotFillRules?: SlotFillRule[]
}

export const DEFAULT_OUTBOUND_AGENTS: OutboundAgentsSettings = {
  masterEnabled: false,
  insuranceVerificationEnabled: false,
  appointmentOptimizationEnabled: false,
  outreachChannel: 'sms',
  smsTemplateName: 'Earlier Appointment Available',
  curogramSmsTemplateName: '',
  curogramSmsActionId: '',
  smsReplyHandling: 'telnyx_inbound',
  triggerScenarios: { ...DEFAULT_TRIGGER_SCENARIOS },
  waveIntervalMinutes: DEFAULT_WAVE_INTERVAL_MINUTES,
  slotFillOutreachMode: 'immediate',
  slotFillRules: [],
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
