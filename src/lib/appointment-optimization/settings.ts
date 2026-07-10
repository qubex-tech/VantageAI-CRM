import { prisma } from '@/lib/db'
import {
  DEFAULT_OUTBOUND_AGENTS,
  DEFAULT_TRIGGER_SCENARIOS,
  DEFAULT_WAVE_INTERVAL_MINUTES,
  MAX_SLOT_FILL_RULES,
  type OpenSlotTriggerScenario,
  type OpenSlotTriggerScenarios,
  type OutboundAgentsSettings,
  type SlotFillRule,
} from '@/lib/appointment-optimization/types'

function parseTriggerScenarios(value: unknown): OpenSlotTriggerScenarios {
  const defaults = { ...DEFAULT_TRIGGER_SCENARIOS }
  if (!value || typeof value !== 'object') {
    return defaults
  }
  const raw = value as Record<string, unknown>
  const keys: OpenSlotTriggerScenario[] = ['cancellation', 'noShow', 'reschedule', 'availability']
  const parsed = { ...defaults }
  for (const key of keys) {
    if (typeof raw[key] === 'boolean') {
      parsed[key] = raw[key]
    }
  }
  return parsed
}

function clampBusinessDays(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(90, Math.max(1, Math.round(value)))
  }
  return fallback
}

function parseSlotFillRules(value: unknown): SlotFillRule[] {
  if (!Array.isArray(value)) return []
  const rules: SlotFillRule[] = []
  for (const item of value.slice(0, MAX_SLOT_FILL_RULES)) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    const visitType = typeof raw.visitType === 'string' ? raw.visitType.trim() : ''
    if (!visitType) continue
    const bufferBusinessDays = clampBusinessDays(raw.bufferBusinessDays, 3)

    // New range fields, with fallback from legacy lookAheadBusinessDays (= end only, start=1).
    const legacyEnd = clampBusinessDays(raw.lookAheadBusinessDays, 14)
    let lookAheadStartBusinessDays = clampBusinessDays(
      raw.lookAheadStartBusinessDays,
      typeof raw.lookAheadBusinessDays === 'number' ? 1 : 7
    )
    let lookAheadEndBusinessDays = clampBusinessDays(
      raw.lookAheadEndBusinessDays,
      legacyEnd
    )
    if (lookAheadStartBusinessDays > lookAheadEndBusinessDays) {
      lookAheadStartBusinessDays = lookAheadEndBusinessDays
    }

    const id =
      typeof raw.id === 'string' && raw.id.trim()
        ? raw.id.trim()
        : `rule-${rules.length + 1}`
    rules.push({
      id,
      visitType,
      bufferBusinessDays,
      lookAheadStartBusinessDays,
      lookAheadEndBusinessDays,
      enabled: raw.enabled !== false,
    })
  }
  return rules
}

function parseWaveIntervalMinutes(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(1440, Math.max(1, Math.round(value)))
  }
  return DEFAULT_WAVE_INTERVAL_MINUTES
}

export function getSlotFillRuleForVisitType(
  settings: OutboundAgentsSettings,
  visitType: string
): SlotFillRule | null {
  const rules = settings.slotFillRules ?? []
  return (
    rules.find((rule) => rule.enabled !== false && rule.visitType === visitType) ?? null
  )
}

export function hasActiveSlotFillRules(settings: OutboundAgentsSettings) {
  return (settings.slotFillRules ?? []).some((rule) => rule.enabled !== false && rule.visitType)
}

export function parseOutboundAgentsSettings(value: unknown): OutboundAgentsSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_OUTBOUND_AGENTS, triggerScenarios: { ...DEFAULT_TRIGGER_SCENARIOS } }
  }
  const raw = value as Record<string, unknown>
  return {
    masterEnabled: Boolean(raw.masterEnabled),
    insuranceVerificationEnabled: Boolean(raw.insuranceVerificationEnabled),
    appointmentOptimizationEnabled: Boolean(raw.appointmentOptimizationEnabled),
    outreachChannel:
      typeof raw.outreachChannel === 'string' ? raw.outreachChannel : DEFAULT_OUTBOUND_AGENTS.outreachChannel,
    smsTemplateName:
      typeof raw.smsTemplateName === 'string' ? raw.smsTemplateName : DEFAULT_OUTBOUND_AGENTS.smsTemplateName,
    curogramSmsTemplateName:
      typeof raw.curogramSmsTemplateName === 'string'
        ? raw.curogramSmsTemplateName
        : DEFAULT_OUTBOUND_AGENTS.curogramSmsTemplateName,
    curogramSmsActionId:
      typeof raw.curogramSmsActionId === 'string'
        ? raw.curogramSmsActionId
        : DEFAULT_OUTBOUND_AGENTS.curogramSmsActionId,
    smsReplyHandling:
      raw.smsReplyHandling === 'practice_number' || raw.smsReplyHandling === 'telnyx_inbound'
        ? raw.smsReplyHandling
        : DEFAULT_OUTBOUND_AGENTS.smsReplyHandling,
    triggerScenarios: parseTriggerScenarios(raw.triggerScenarios),
    waveIntervalMinutes: parseWaveIntervalMinutes(raw.waveIntervalMinutes),
    slotFillRules: parseSlotFillRules(raw.slotFillRules),
  }
}

export function isTriggerScenarioEnabled(
  settings: OutboundAgentsSettings,
  scenario: OpenSlotTriggerScenario
) {
  return settings.triggerScenarios?.[scenario] ?? DEFAULT_TRIGGER_SCENARIOS[scenario]
}

export async function getOutboundAgentsSettings(practiceId: string): Promise<OutboundAgentsSettings> {
  const row = await prisma.practiceSettings.findUnique({
    where: { practiceId },
    select: { outboundAgents: true },
  })
  return parseOutboundAgentsSettings(row?.outboundAgents)
}

export function isAppointmentOptimizationEnabled(settings: OutboundAgentsSettings) {
  return settings.masterEnabled && settings.appointmentOptimizationEnabled
}

export async function saveOutboundAgentsSettings(
  practiceId: string,
  settings: OutboundAgentsSettings
) {
  return prisma.practiceSettings.upsert({
    where: { practiceId },
    create: {
      practiceId,
      outboundAgents: settings,
    },
    update: {
      outboundAgents: settings,
    },
  })
}
