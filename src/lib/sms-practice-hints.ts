import { prisma } from '@/lib/db'

function formatPracticeRef(
  name: string,
  patientCount: number,
  practiceId: string
): string {
  return `"${name}" (${patientCount} patient${patientCount === 1 ? '' : 's'}, ID …${practiceId.slice(-8)})`
}

export async function getTelnyxPracticeMismatchHint(
  practiceId: string
): Promise<string | null> {
  const practice = await prisma.practice.findUnique({
    where: { id: practiceId },
    select: {
      name: true,
      _count: { select: { patients: true } },
    },
  })

  if (!practice) {
    return null
  }

  const telnyxElsewhere = await prisma.telnyxIntegration.findMany({
    where: {
      isActive: true,
      practiceId: { not: practiceId },
    },
    include: {
      practice: {
        select: {
          id: true,
          name: true,
          _count: { select: { patients: true } },
        },
      },
    },
  })

  const sameNameIntegrations = telnyxElsewhere.filter(
    (integration) => integration.practice.name === practice.name
  )

  if (sameNameIntegrations.length === 0) {
    return null
  }

  const configured = sameNameIntegrations[0]
  const targetPatientCount = practice._count.patients
  const configuredPatientCount = configured.practice._count.patients

  if (targetPatientCount >= configuredPatientCount) {
    return (
      `Telnyx is configured on ${formatPracticeRef(configured.practice.name, configuredPatientCount, configured.practice.id)} ` +
      `but this send uses ${formatPracticeRef(practice.name, targetPatientCount, practiceId)}. ` +
      `In Settings → Practice API Configuration, select the "${practice.name}" entry with ${targetPatientCount} patients and save Telnyx there.`
    )
  }

  return (
    `Telnyx is configured on ${formatPracticeRef(configured.practice.name, configuredPatientCount, configured.practice.id)} ` +
    `but patients may belong to ${formatPracticeRef(practice.name, targetPatientCount, practiceId)}. ` +
    `Choose the practice entry whose patient count matches where you send SMS.`
  )
}
