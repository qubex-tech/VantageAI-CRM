import { prisma } from '@/lib/db'
import { getSmsClient } from '@/lib/sms'
import {
  normalizeCurogramAiV2Gender,
  normalizePhoneToE164,
  sendCurogramAiCallsToAction,
} from '@/lib/curogram'
import { getRetellIntegrationConfig, RetellApiClient } from '@/lib/retell-api'
import { findEligibleCandidates } from '@/lib/appointment-optimization/candidates'
import { parseOpenSlotEventMetadata } from '@/lib/appointment-optimization/slotFillUtils'
import {
  formatProviderDisplayName,
  resolveEarlierSlotSmsBody,
} from '@/lib/appointment-optimization/messages'
import {
  getOutboundAgentsSettings,
  isAppointmentOptimizationEnabled,
} from '@/lib/appointment-optimization/settings'
import {
  isOpenSlotFilled,
  markOpenSlotFilled,
  syncOpenSlotLifecycle,
} from '@/lib/appointment-optimization/slotFilled'
import { WAVE_BATCH_SIZE } from '@/lib/appointment-optimization/types'
import { formatAppointmentForVoice, type VoiceAppointment } from '@/lib/appointments/voice-context'
import { refreshPatientAppointmentsFromOpenDentalForVoice } from '@/lib/appointments/live-opendental-refresh'
import { notifySlotFillOutreachSent } from '@/lib/appointment-optimization/slotFillPushNotification'

function providerDisplayFromRef(providerId: string | null) {
  return formatProviderDisplayName(providerId, 'your provider')
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

/**
 * Resolve the patient's current appointment (the one an earlier slot would
 * replace) into a voice-agent-friendly summary. Best-effort: never throws.
 * When patientId is known, live-refreshes from Open Dental first.
 */
async function resolveCurrentAppointmentContext(params: {
  appointmentId?: string | null
  patientId?: string
  practiceId?: string
}): Promise<VoiceAppointment | null> {
  try {
    if (params.patientId && params.practiceId) {
      await refreshPatientAppointmentsFromOpenDentalForVoice({
        practiceId: params.practiceId,
        patientId: params.patientId,
      })
    }

    const where = params.appointmentId
      ? { id: params.appointmentId }
      : params.patientId
        ? {
            patientId: params.patientId,
            startTime: { gte: new Date() },
            status: { in: ['scheduled', 'confirmed'] },
          }
        : null
    if (!where) return null

    const appt = await prisma.appointment.findFirst({
      where,
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        status: true,
        startTime: true,
        endTime: true,
        timezone: true,
        visitType: true,
        reason: true,
        notes: true,
        providerId: true,
      },
    })
    return appt ? formatAppointmentForVoice(appt) : null
  } catch (error) {
    console.warn('[SlotFill] failed to resolve current appointment context', {
      error: error instanceof Error ? error.message : error,
    })
    return null
  }
}

export async function processSlotWave(params: {
  openSlotEventId: string
  practiceId: string
  waveNumber: number
  /** Optional overrides from workflow automation send_slot_fill_outreach action */
  overrides?: {
    outreachChannel?: string
    smsTemplateName?: string
    curogramSmsActionId?: string
    curogramSmsTemplateName?: string
  }
}) {
  const baseSettings = await getOutboundAgentsSettings(params.practiceId)
  if (!isAppointmentOptimizationEnabled(baseSettings)) {
    return { status: 'skipped', reason: 'agent_disabled' }
  }

  const settings = {
    ...baseSettings,
    ...(params.overrides?.outreachChannel
      ? { outreachChannel: params.overrides.outreachChannel }
      : {}),
    ...(params.overrides?.smsTemplateName
      ? { smsTemplateName: params.overrides.smsTemplateName }
      : {}),
    ...(params.overrides?.curogramSmsActionId
      ? { curogramSmsActionId: params.overrides.curogramSmsActionId }
      : {}),
    ...(params.overrides?.curogramSmsTemplateName
      ? { curogramSmsTemplateName: params.overrides.curogramSmsTemplateName }
      : {}),
  }

  const slot = await prisma.openSlotEvent.findFirst({
    where: { id: params.openSlotEventId, practiceId: params.practiceId },
  })
  if (!slot || slot.status !== 'open') {
    return { status: 'skipped', reason: 'slot_not_open' }
  }

  if (await isOpenSlotFilled(slot.id)) {
    await markOpenSlotFilled(slot.id)
    return { status: 'skipped', reason: 'slot_already_filled' }
  }

  const wave = await prisma.slotWave.upsert({
    where: {
      openSlotEventId_waveNumber: {
        openSlotEventId: slot.id,
        waveNumber: params.waveNumber,
      },
    },
    create: {
      practiceId: params.practiceId,
      openSlotEventId: slot.id,
      waveNumber: params.waveNumber,
      status: 'processing',
      startedAt: new Date(),
    },
    update: {
      status: 'processing',
      startedAt: new Date(),
    },
  })

  const { lookAheadStart, lookAheadEnd, slotFillRuleId } = parseOpenSlotEventMetadata(slot.metadata)

  const candidates = await findEligibleCandidates({
    practiceId: params.practiceId,
    providerId: slot.providerId,
    appointmentType: slot.appointmentType,
    slotStart: slot.slotStart,
    slotEnd: slot.slotEnd,
    durationMinutes: slot.durationMinutes,
    openSlotEventId: slot.id,
    waveNumber: params.waveNumber,
    limit: WAVE_BATCH_SIZE,
    lookAheadStart,
    lookAheadEnd,
    slotFillRuleId,
  })

  if (candidates.length === 0) {
    await prisma.slotWave.update({
      where: { id: wave.id },
      data: { status: 'completed', completedAt: new Date(), patientsTargeted: 0 },
    })
    if (await isOpenSlotFilled(slot.id)) {
      await markOpenSlotFilled(slot.id)
      return { status: 'skipped', reason: 'slot_already_filled' }
    }
    // Keep the slot open for wave-1 replies until the time is actually occupied.
    return { status: 'no_more_candidates', patientsContacted: 0 }
  }

  const practice = await prisma.practice.findUnique({
    where: { id: params.practiceId },
    select: { name: true },
  })

  let sentCount = 0
  const channel = settings.outreachChannel || 'sms'

  for (const candidate of candidates) {
    const messageBody = await resolveEarlierSlotSmsBody({
      practiceId: params.practiceId,
      templateName: settings.smsTemplateName,
      patientFirstName: candidate.patientName.split(' ')[0] || 'there',
      providerName: providerDisplayFromRef(slot.providerId),
      slotStart: slot.slotStart,
      timezone: 'America/Chicago',
      visitType: slot.appointmentType,
      currentAppointmentStart: candidate.appointmentStart,
    })

    const attempt = await prisma.outreachAttempt.create({
      data: {
        practiceId: params.practiceId,
        openSlotEventId: slot.id,
        slotWaveId: wave.id,
        patientId: candidate.patientId,
        appointmentId: candidate.appointmentId,
        channel: channel === 'voice' ? 'voice' : 'sms',
        status: 'queued',
        waveNumber: params.waveNumber,
        messageBody,
      },
    })

    try {
      const useVoice = channel === 'voice' || channel === 'prefer_voice'
      if (useVoice) {
        await sendVoiceOutreach({
          practiceId: params.practiceId,
          attemptId: attempt.id,
          phone: candidate.phone!,
          patientName: candidate.patientName,
          slotStart: slot.slotStart,
          openSlotEventId: slot.id,
          patientId: candidate.patientId,
          currentAppointmentId: candidate.appointmentId ?? null,
        })
      } else if (channel === 'curogram_sms') {
        await sendCurogramSmsOutreach({
          practiceId: params.practiceId,
          attemptId: attempt.id,
          openSlotEventId: slot.id,
          patientId: candidate.patientId,
          phone: candidate.phone!,
          patientName: candidate.patientName,
          actionId: settings.curogramSmsActionId || '',
          templateName: settings.curogramSmsTemplateName || '',
        })
        void notifySlotFillOutreachSent({
          practiceId: params.practiceId,
          openSlotEventId: slot.id,
          outreachAttemptId: attempt.id,
          patientName: candidate.patientName,
          slotStart: slot.slotStart,
          providerId: slot.providerId,
          waveNumber: params.waveNumber,
          messagePreview: settings.curogramSmsTemplateName
            ? `Curogram: ${settings.curogramSmsTemplateName}`
            : messageBody,
        })
      } else {
        await sendSmsOutreach({
          practiceId: params.practiceId,
          attemptId: attempt.id,
          phone: candidate.phone!,
          body: messageBody,
        })
        void notifySlotFillOutreachSent({
          practiceId: params.practiceId,
          openSlotEventId: slot.id,
          outreachAttemptId: attempt.id,
          patientName: candidate.patientName,
          slotStart: slot.slotStart,
          providerId: slot.providerId,
          waveNumber: params.waveNumber,
          messagePreview: messageBody,
        })
      }
      sentCount += 1
    } catch (error) {
      await prisma.outreachAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'failed',
        },
      })
      console.error('[SlotFill] outreach failed', {
        attemptId: attempt.id,
        error: error instanceof Error ? error.message : error,
      })
    }
  }

  await prisma.slotWave.update({
    where: { id: wave.id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      patientsTargeted: candidates.length,
    },
  })

  await prisma.openSlotEvent.update({
    where: { id: slot.id },
    data: {
      wavesSent: { increment: 1 },
      patientsContacted: { increment: sentCount },
    },
  })

  return {
    status: 'wave_sent',
    waveNumber: params.waveNumber,
    patientsContacted: sentCount,
    practiceName: practice?.name,
  }
}

async function sendSmsOutreach(params: {
  practiceId: string
  attemptId: string
  phone: string
  body: string
}) {
  const sms = await getSmsClient(params.practiceId)
  const result = await sms.sendSms({ to: params.phone, body: params.body })
  if (!result.success) {
    throw new Error(result.error || 'SMS send failed')
  }
  await prisma.outreachAttempt.update({
    where: { id: params.attemptId },
    data: {
      status: 'sent',
      externalMessageId: result.messageId || null,
      sentAt: new Date(),
    },
  })
}

async function sendCurogramSmsOutreach(params: {
  practiceId: string
  attemptId: string
  openSlotEventId: string
  patientId: string
  phone: string
  patientName: string
  actionId: string
  templateName: string
}) {
  const patient = await prisma.patient.findUnique({
    where: { id: params.patientId },
    select: {
      firstName: true,
      lastName: true,
      name: true,
      dateOfBirth: true,
      gender: true,
      primaryPhone: true,
      phone: true,
    },
  })
  if (!patient?.dateOfBirth) {
    throw new Error('Missing patient DOB for Curogram SMS outreach')
  }
  const firstName =
    patient.firstName?.trim() || splitName(patient.name || params.patientName).firstName
  const lastName = patient.lastName?.trim() || splitName(patient.name || params.patientName).lastName
  if (!firstName || !lastName) {
    throw new Error('Missing patient first/last name for Curogram SMS outreach')
  }

  const phone =
    normalizePhoneToE164(patient.primaryPhone || patient.phone || params.phone) ||
    normalizePhoneToE164(params.phone)
  if (!phone) {
    throw new Error('Missing valid patient phone for Curogram SMS outreach')
  }

  const actionId = params.actionId.trim()
  if (!actionId) {
    throw new Error('Missing Curogram action ID for Curogram SMS outreach')
  }

  const normalizedGender = normalizeCurogramAiV2Gender(patient.gender)
  const requestId = `slotfill-curogram-action-${params.attemptId}`
  const result = await sendCurogramAiCallsToAction(
    {
      firstName,
      lastName,
      phoneNumber: phone,
      dob: patient.dateOfBirth.toISOString(),
      actionId,
      ...(normalizedGender ? { gender: normalizedGender } : {}),
    },
    {
      requestId,
      callId: params.openSlotEventId,
    }
  )
  if (!result.ok) {
    throw new Error(
      `Curogram calls-to-action failed (${result.status}): ${result.body.slice(0, 200)}`
    )
  }

  await prisma.outreachAttempt.update({
    where: { id: params.attemptId },
    data: {
      status: 'sent',
      externalMessageId: requestId,
      messageBody:
        params.templateName.trim()
          ? `Curogram template: ${params.templateName.trim()}`
          : 'Curogram SMS action trigger',
      sentAt: new Date(),
    },
  })
}

async function sendVoiceOutreach(params: {
  practiceId: string
  attemptId: string
  phone: string
  patientName: string
  slotStart: Date
  openSlotEventId: string
  patientId?: string
  currentAppointmentId?: string | null
}) {
  const config = await getRetellIntegrationConfig(params.practiceId)
  if (!config.apiKey) {
    throw new Error('Retell not configured')
  }
  const fromNumber = process.env.RETELL_FROM_NUMBER
  if (!fromNumber) {
    throw new Error('RETELL_FROM_NUMBER not configured')
  }

  // Give the agent the patient's current appointment (the one this earlier slot
  // would replace) so it can reference it naturally on the call. Best-effort.
  const currentAppointment = await resolveCurrentAppointmentContext({
    appointmentId: params.currentAppointmentId,
    patientId: params.patientId,
    practiceId: params.practiceId,
  })

  const client = new RetellApiClient(config.apiKey)
  const response = await client.createPhoneCall({
    fromNumber,
    toNumber: params.phone,
    overrideAgentId: config.agentId || undefined,
    metadata: {
      openSlotEventId: params.openSlotEventId,
      outreachAttemptId: params.attemptId,
      purpose: 'appointment_optimization',
    },
    dynamicVariables: {
      patient_name: params.patientName,
      offered_slot_datetime: params.slotStart.toISOString(),
      portal_link: (process.env.APP_BASE_URL || '') + '/portal/appointments',
      has_current_appointment: currentAppointment ? 'true' : 'false',
      current_appointment_summary: currentAppointment?.summary || '',
      current_appointment_datetime: currentAppointment?.start_time || '',
    },
  })
  const callId =
    (typeof response.call_id === 'string' && response.call_id) ||
    (typeof response.callId === 'string' && response.callId) ||
    null
  await prisma.outreachAttempt.update({
    where: { id: params.attemptId },
    data: {
      status: 'sent',
      externalMessageId: callId,
      sentAt: new Date(),
    },
  })
}

export async function handleSlotFillCheck(params: {
  openSlotEventId: string
  practiceId: string
  waveNumber: number
}) {
  const slot = await prisma.openSlotEvent.findFirst({
    where: { id: params.openSlotEventId, practiceId: params.practiceId },
  })
  if (!slot) return { action: 'missing' }

  await syncOpenSlotLifecycle(params.openSlotEventId)

  const refreshed = await prisma.openSlotEvent.findFirst({
    where: { id: params.openSlotEventId, practiceId: params.practiceId },
  })
  if (!refreshed) return { action: 'missing' }

  if (refreshed.status === 'filled' || (await isOpenSlotFilled(params.openSlotEventId))) {
    return { action: 'filled' }
  }

  if (refreshed.status === 'exhausted' || refreshed.slotStart <= new Date()) {
    return { action: 'expired' }
  }

  const nextWave = params.waveNumber + 1
  return { action: 'continue', nextWave }
}
