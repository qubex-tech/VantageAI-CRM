import { prisma } from '@/lib/db'
import {
  DEFAULT_OUTBOUND_AGENTS,
  type OutboundAgentsSettings,
} from '@/lib/appointment-optimization/types'

export function parseOutboundAgentsSettings(value: unknown): OutboundAgentsSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_OUTBOUND_AGENTS }
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
  }
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
