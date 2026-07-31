import { notifyPractice } from '@/lib/push-notifications'

const CONTROL_FLOW_ACTIONS = new Set([
  'delay_seconds',
  'wait_until_local_time',
  'wait_until_send_window',
])

export interface AutomationRunPushParams {
  practiceId: string
  ruleId: string
  ruleName: string
  triggerEvent: string
  runId: string
  status: 'succeeded' | 'failed'
  patientId?: string | null
  patientName?: string | null
  actionResults?: Array<{ actionType: string; status: string }>
}

function resolvePatientLabel(patientName?: string | null): string | null {
  if (!patientName || typeof patientName !== 'string') return null
  const trimmed = patientName.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0] || trimmed
}

/**
 * Skip practice push when the only substantive action was slot-fill outreach,
 * which already sends its own practice notification.
 */
export function shouldSkipAutomationPush(
  actionResults: Array<{ actionType: string; status: string }> = []
): boolean {
  const substantive = actionResults.filter(
    (action) => !CONTROL_FLOW_ACTIONS.has(action.actionType)
  )
  return (
    substantive.length > 0 &&
    substantive.every((action) => action.actionType === 'send_slot_fill_outreach')
  )
}

export function buildAutomationRunPushMessage(params: AutomationRunPushParams): {
  title: string
  body: string
  data: Record<string, unknown>
} {
  const patientLabel = resolvePatientLabel(params.patientName)
  const failed = params.status === 'failed'
  const title = failed ? 'Automation failed' : 'Automation ran'
  const bodyParts = [params.ruleName]
  if (patientLabel) bodyParts.push(patientLabel)
  bodyParts.push(params.triggerEvent)

  return {
    title,
    body: bodyParts.join(' · '),
    data: {
      type: 'automation',
      ruleId: params.ruleId,
      ruleName: params.ruleName,
      triggerEvent: params.triggerEvent,
      runId: params.runId,
      status: params.status,
      ...(params.patientId ? { patientId: params.patientId } : {}),
    },
  }
}

/**
 * Notify all mobile users in the practice when an automation runs.
 * Fire-and-forget — never throws.
 */
export async function notifyPracticeAutomationRun(
  params: AutomationRunPushParams
): Promise<void> {
  try {
    if (shouldSkipAutomationPush(params.actionResults)) {
      return
    }
    const message = buildAutomationRunPushMessage(params)
    await notifyPractice(params.practiceId, message)
  } catch (err) {
    console.error('[push] automation run notification failed:', err)
  }
}
