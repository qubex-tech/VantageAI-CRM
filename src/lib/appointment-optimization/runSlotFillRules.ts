import {
  listPendingOpenTimeSlots,
  ingestOpenTimeSlot,
} from '@/lib/appointment-optimization/openSlotInventory'
import { evaluateOpenTimeSlot } from '@/lib/appointment-optimization/rulesEngine'
import {
  getOutboundAgentsSettings,
  hasActiveSlotFillRules,
  isAppointmentOptimizationEnabled,
  parseOutboundAgentsSettings,
} from '@/lib/appointment-optimization/settings'
import type { OpenTimeSlot } from '@/lib/appointment-optimization/types'
import { prisma } from '@/lib/db'

export type RunSlotFillRulesSummary = {
  practiceId: string
  evaluated: number
  outreachStarted: number
  skipped: number
  results: Array<{ inventoryId?: string; action: string; reason?: string }>
}

export async function runSlotFillRulesForPractice(
  practiceId: string
): Promise<RunSlotFillRulesSummary> {
  const settings = await getOutboundAgentsSettings(practiceId)
  if (!isAppointmentOptimizationEnabled(settings) || !hasActiveSlotFillRules(settings)) {
    return {
      practiceId,
      evaluated: 0,
      outreachStarted: 0,
      skipped: 0,
      results: [],
    }
  }

  const pending = await listPendingOpenTimeSlots(practiceId)
  const results: RunSlotFillRulesSummary['results'] = []
  let outreachStarted = 0
  let skipped = 0

  for (const slot of pending) {
    const result = await evaluateOpenTimeSlot(slot)
    results.push({
      inventoryId: slot.inventoryId,
      action: result.action,
      reason: result.reason,
    })
    if (result.action === 'outreach_started') outreachStarted += 1
    else skipped += 1
  }

  return {
    practiceId,
    evaluated: pending.length,
    outreachStarted,
    skipped,
    results,
  }
}

/** Ingest then immediately evaluate (reactive path). */
export async function ingestAndEvaluateOpenTimeSlot(slot: OpenTimeSlot) {
  const { id } = await ingestOpenTimeSlot(slot)
  return evaluateOpenTimeSlot({ ...slot, inventoryId: id })
}

export async function listPracticesWithActiveSlotFillRules(): Promise<string[]> {
  const rows = await prisma.practiceSettings.findMany({
    where: { outboundAgents: { not: null } },
    select: { practiceId: true, outboundAgents: true },
  })
  const practiceIds: string[] = []
  for (const row of rows) {
    const settings = parseOutboundAgentsSettings(row.outboundAgents)
    if (!isAppointmentOptimizationEnabled(settings)) continue
    if (!hasActiveSlotFillRules(settings)) continue
    practiceIds.push(row.practiceId)
  }
  return practiceIds
}
