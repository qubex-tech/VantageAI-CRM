import { prisma } from '@/lib/db'
import { findPatientBySmsPhone } from '@/lib/patient-phone-match'
import { phoneNumbersMatch } from '@/lib/telnyx'

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

export async function resolveInboundSmsPatient(params: {
  from: string
  messagingProfileId?: string | null
  toNumbers: string[]
}): Promise<{
  patient: Awaited<ReturnType<typeof findPatientBySmsPhone>>
  integrationPracticeIds: string[]
} | null> {
  const integrations = await findMatchingTelnyxIntegrations({
    messagingProfileId: params.messagingProfileId,
    toNumbers: params.toNumbers,
  })

  if (integrations.length === 0) {
    return null
  }

  const integrationPracticeIds = integrations.map((entry) => entry.practiceId)

  // Only match patients in practices that have this Telnyx number/profile configured,
  // so inbound threads align with outbound (same practice + patient record).
  const patient = await findPatientBySmsPhone({
    from: params.from,
    onlyPracticeIds: integrationPracticeIds,
  })

  if (!patient) {
    return { patient: null, integrationPracticeIds }
  }

  return { patient, integrationPracticeIds }
}
