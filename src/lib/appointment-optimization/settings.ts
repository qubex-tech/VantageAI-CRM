import { prisma } from '@/lib/db'
import {
  DEFAULT_OUTBOUND_AGENTS,
  DEFAULT_TRIGGER_SCENARIOS,
  type OpenSlotTriggerScenario,
  type OpenSlotTriggerScenarios,
  type OutboundAgentsSettings,
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
    triggerScenarios: parseTriggerScenarios(raw.triggerScenarios),
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
