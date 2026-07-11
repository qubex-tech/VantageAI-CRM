import { notifyPractice } from '@/lib/push-notifications'
import { formatSlotDateTime } from '@/lib/appointment-optimization/formatSlotTimes'

const DEFAULT_TIMEZONE = 'America/Chicago'

export interface SlotFillOutreachPushParams {
  practiceId: string
  openSlotEventId: string
  outreachAttemptId: string
  patientName: string
  slotStart: Date
  providerId?: string | null
  waveNumber: number
  /** First line of the SMS that was sent (optional preview). */
  messagePreview?: string | null
  timezone?: string
}

export function buildSlotFillOutreachPushMessage(params: SlotFillOutreachPushParams): {
  title: string
  body: string
  data: Record<string, unknown>
} {
  const timezone = params.timezone ?? DEFAULT_TIMEZONE
  const slotLabel = formatSlotDateTime(params.slotStart, timezone)
  const patientFirstName = params.patientName.trim().split(/\s+/)[0] || 'Patient'

  const preview = params.messagePreview?.trim()
  const bodyParts = [
    `To ${patientFirstName}`,
    `Wave ${params.waveNumber}`,
    slotLabel,
  ]
  if (preview) {
    bodyParts.push(preview.length > 80 ? `${preview.slice(0, 77)}…` : preview)
  }

  return {
    title: '📅 Slot fill text sent',
    body: bodyParts.join(' · '),
    data: {
      type: 'slot_fill',
      openSlotEventId: params.openSlotEventId,
      outreachAttemptId: params.outreachAttemptId,
      waveNumber: params.waveNumber,
    },
  }
}

/**
 * Notify all mobile users in the practice when a slot-fill SMS is sent.
 * Fire-and-forget — never throws.
 */
export async function notifySlotFillOutreachSent(
  params: SlotFillOutreachPushParams
): Promise<void> {
  try {
    const message = buildSlotFillOutreachPushMessage(params)
    await notifyPractice(params.practiceId, message)
  } catch (err) {
    console.error('[push] slot fill outreach notification failed:', err)
  }
}
