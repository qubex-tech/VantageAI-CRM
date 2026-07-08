import { inngest } from '../client'
import { processSlotWave, handleSlotFillCheck } from '@/lib/appointment-optimization/outreach'
import { WAVE_WAIT_MS } from '@/lib/appointment-optimization/types'

function shouldStopWaves(result: { status?: string; reason?: string } | undefined) {
  if (!result) return false
  if (result.status === 'no_more_candidates') return true
  if (result.status === 'skipped' && result.reason === 'slot_already_filled') return true
  return false
}

export const handleOpenSlotCreated = inngest.createFunction(
  {
    id: 'appointment-optimization-open-slot-created',
    name: 'Appointment Optimization — Open Slot Created',
    retries: 3,
  },
  { event: 'crm/open-slot.created' },
  async ({ event, step }) => {
    const { openSlotEventId, practiceId } = event.data as {
      openSlotEventId: string
      practiceId: string
    }

    await step.run('wave-1-send', async () => {
      return processSlotWave({ openSlotEventId, practiceId, waveNumber: 1 })
    })

    await step.sleep('wait-after-wave-1', WAVE_WAIT_MS)

    const check1 = await step.run('check-after-wave-1', async () => {
      return handleSlotFillCheck({ openSlotEventId, practiceId, waveNumber: 1 })
    })
    if (check1.action === 'filled' || check1.action === 'missing' || check1.action === 'expired') {
      return check1
    }

    const wave2 = await step.run('wave-2-send', async () => {
      return processSlotWave({ openSlotEventId, practiceId, waveNumber: 2 })
    })
    if (shouldStopWaves(wave2)) {
      return { ...check1, awaitingReplies: true, lastWave: 2, wave2 }
    }

    await step.sleep('wait-after-wave-2', WAVE_WAIT_MS)

    const check2 = await step.run('check-after-wave-2', async () => {
      return handleSlotFillCheck({ openSlotEventId, practiceId, waveNumber: 2 })
    })
    if (check2.action === 'filled' || check2.action === 'missing' || check2.action === 'expired') {
      return check2
    }

    const wave3 = await step.run('wave-3-send', async () => {
      return processSlotWave({ openSlotEventId, practiceId, waveNumber: 3 })
    })
    if (shouldStopWaves(wave3)) {
      return { ...check2, awaitingReplies: true, lastWave: 3, wave3 }
    }

    return { completed: true, waves: 3 }
  }
)

/** Manual / API trigger to re-check a slot and optionally queue next wave */
export const checkOpenSlotStatus = inngest.createFunction(
  {
    id: 'appointment-optimization-slot-check',
    name: 'Appointment Optimization — Slot Status Check',
  },
  { event: 'crm/open-slot.check-filled' },
  async ({ event, step }) => {
    const { openSlotEventId, practiceId, waveNumber } = event.data as {
      openSlotEventId: string
      practiceId: string
      waveNumber: number
    }

    return step.run('check-filled', async () => {
      return handleSlotFillCheck({ openSlotEventId, practiceId, waveNumber })
    })
  }
)

export async function enqueueOpenSlotCheck(params: {
  openSlotEventId: string
  practiceId: string
  waveNumber: number
  delayMs?: number
}) {
  return inngest.send({
    name: 'crm/open-slot.check-filled',
    data: params,
    ...(params.delayMs
      ? { ts: Date.now() + params.delayMs }
      : {}),
  })
}
