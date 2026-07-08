import { prisma } from '@/lib/db'
import { findActiveSlotFillOutreachByReplyPhone } from '@/lib/appointment-optimization/findActiveSlotFillOutreach'
import {
  findPatientBySmsPhone,
  patientMatchesReplyPhone,
  type PatientPhoneMatch,
} from '@/lib/patient-phone-match'
import { phoneNumbersMatch } from '@/lib/telnyx'

const RECENT_OUTREACH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

const patientSelect = {
  id: true,
  practiceId: true,
  name: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  phone: true,
  primaryPhone: true,
  secondaryPhone: true,
} as const

export type InboundSmsPatientResolution =
  | 'slot_fill_outreach'
  | 'recent_sms_outreach'
  | 'recent_outbound_message'
  | 'unique_phone_match'

export async function findMatchingTelnyxIntegrations(params: {
  messagingProfileId?: string | null
  toNumbers: string[]
}): Promise<Array<{ practiceId: string; fromNumber: string }>> {
  const matches: Array<{ practiceId: string; fromNumber: string }> = []
  const seenPracticeIds = new Set<string>()

  if (params.messagingProfileId) {
    const byProfile = await prisma.telnyxIntegration.findMany({
      where: {
        messagingProfileId: params.messagingProfileId,
        isActive: true,
      },
      select: { practiceId: true, fromNumber: true },
      orderBy: { updatedAt: 'desc' },
    })
    for (const entry of byProfile) {
      if (!seenPracticeIds.has(entry.practiceId)) {
        seenPracticeIds.add(entry.practiceId)
        matches.push(entry)
      }
    }
  }

  const integrations = await prisma.telnyxIntegration.findMany({
    where: { isActive: true },
    select: { practiceId: true, fromNumber: true, messagingProfileId: true },
    orderBy: { updatedAt: 'desc' },
  })

  for (const entry of integrations) {
    if (seenPracticeIds.has(entry.practiceId)) continue
    const numberMatches = params.toNumbers.some((toNumber) =>
      phoneNumbersMatch(entry.fromNumber, toNumber)
    )
    if (numberMatches) {
      seenPracticeIds.add(entry.practiceId)
      matches.push({ practiceId: entry.practiceId, fromNumber: entry.fromNumber })
    }
  }

  return matches
}

async function loadPatientById(patientId: string): Promise<PatientPhoneMatch | null> {
  return prisma.patient.findFirst({
    where: { id: patientId, deletedAt: null },
    select: patientSelect,
  })
}

/**
 * Most recent SMS outreach we sent to this reply number — returns the patientId we targeted.
 */
export async function resolvePatientIdFromRecentSmsOutreach(params: {
  practiceIds: string[]
  replyFrom: string
}): Promise<string | null> {
  if (params.practiceIds.length === 0) return null

  const since = new Date(Date.now() - RECENT_OUTREACH_WINDOW_MS)
  const attempts = await prisma.outreachAttempt.findMany({
    where: {
      practiceId: { in: params.practiceIds },
      channel: 'sms',
      status: { in: ['sent', 'delivered', 'accepted'] },
      sentAt: { gte: since },
    },
    orderBy: { sentAt: 'desc' },
    take: 25,
    include: {
      patient: {
        select: {
          id: true,
          phone: true,
          primaryPhone: true,
          secondaryPhone: true,
        },
      },
    },
  })

  for (const attempt of attempts) {
    if (patientMatchesReplyPhone(attempt.patient, params.replyFrom)) {
      return attempt.patientId
    }
  }

  return null
}

/**
 * Most recent outbound inbox SMS to any patient with this reply number.
 */
export async function resolvePatientIdFromRecentOutboundMessage(params: {
  practiceIds: string[]
  replyFrom: string
}): Promise<string | null> {
  if (params.practiceIds.length === 0) return null

  const patients = await prisma.patient.findMany({
    where: { practiceId: { in: params.practiceIds }, deletedAt: null },
    select: {
      id: true,
      phone: true,
      primaryPhone: true,
      secondaryPhone: true,
    },
    take: 500,
  })

  const matchingIds = patients
    .filter((patient) => patientMatchesReplyPhone(patient, params.replyFrom))
    .map((patient) => patient.id)

  if (matchingIds.length === 0) return null

  const recent = await prisma.communicationMessage.findFirst({
    where: {
      practiceId: { in: params.practiceIds },
      patientId: { in: matchingIds },
      direction: 'outbound',
      channel: 'sms',
    },
    orderBy: { createdAt: 'desc' },
    select: { patientId: true },
  })

  return recent?.patientId ?? null
}

/**
 * Resolve which patient an inbound SMS belongs to.
 * Prefers explicit patientId from outreach/conversation context over demographic guessing.
 */
export async function resolveInboundSmsPatient(params: {
  from: string
  messagingProfileId?: string | null
  toNumbers: string[]
}): Promise<{
  patient: PatientPhoneMatch | null
  integrationPracticeIds: string[]
  resolution?: InboundSmsPatientResolution
} | null> {
  const integrations = await findMatchingTelnyxIntegrations({
    messagingProfileId: params.messagingProfileId,
    toNumbers: params.toNumbers,
  })

  if (integrations.length === 0) {
    return null
  }

  const integrationPracticeIds = integrations.map((entry) => entry.practiceId)

  const slotFillAttempt = await findActiveSlotFillOutreachByReplyPhone({
    practiceIds: integrationPracticeIds,
    replyFrom: params.from,
  })
  if (slotFillAttempt) {
    const patient = await loadPatientById(slotFillAttempt.patientId)
    return {
      patient,
      integrationPracticeIds,
      resolution: 'slot_fill_outreach',
    }
  }

  const recentOutreachPatientId = await resolvePatientIdFromRecentSmsOutreach({
    practiceIds: integrationPracticeIds,
    replyFrom: params.from,
  })
  if (recentOutreachPatientId) {
    const patient = await loadPatientById(recentOutreachPatientId)
    return {
      patient,
      integrationPracticeIds,
      resolution: 'recent_sms_outreach',
    }
  }

  const recentMessagePatientId = await resolvePatientIdFromRecentOutboundMessage({
    practiceIds: integrationPracticeIds,
    replyFrom: params.from,
  })
  if (recentMessagePatientId) {
    const patient = await loadPatientById(recentMessagePatientId)
    return {
      patient,
      integrationPracticeIds,
      resolution: 'recent_outbound_message',
    }
  }

  // Last resort: phone match only when a single patient shares this number in-scope.
  const patient = await findPatientBySmsPhone({
    from: params.from,
    onlyPracticeIds: integrationPracticeIds,
  })

  if (!patient) {
    return { patient: null, integrationPracticeIds }
  }

  return {
    patient,
    integrationPracticeIds,
    resolution: 'unique_phone_match',
  }
}
