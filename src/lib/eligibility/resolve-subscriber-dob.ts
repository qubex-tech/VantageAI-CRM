import { prisma } from '@/lib/db'

export async function findSubscriberDobInPractice(params: {
  practiceId: string
  excludePatientId?: string
  firstName?: string | null
  lastName?: string | null
  subscriberPatNum?: number | null
}): Promise<Date | null> {
  const first = params.firstName?.trim()
  const last = params.lastName?.trim()

  if (params.subscriberPatNum && params.subscriberPatNum > 0) {
    const byEhr = await prisma.patient.findMany({
      where: {
        practiceId: params.practiceId,
        deletedAt: null,
        dateOfBirth: { not: null },
        ...(params.excludePatientId ? { id: { not: params.excludePatientId } } : {}),
        externalEhrId: `opendental:${params.subscriberPatNum}`,
      },
      select: { dateOfBirth: true },
      take: 2,
    })
    if (byEhr.length === 1 && byEhr[0].dateOfBirth) {
      return byEhr[0].dateOfBirth
    }
  }

  if (!first || !last) return null

  const byName = await prisma.patient.findMany({
    where: {
      practiceId: params.practiceId,
      deletedAt: null,
      dateOfBirth: { not: null },
      firstName: { equals: first, mode: 'insensitive' },
      lastName: { equals: last, mode: 'insensitive' },
      ...(params.excludePatientId ? { id: { not: params.excludePatientId } } : {}),
    },
    select: { dateOfBirth: true },
    take: 2,
  })
  if (byName.length === 1 && byName[0].dateOfBirth) {
    return byName[0].dateOfBirth
  }
  return null
}

export async function fillMissingSubscriberDob(params: {
  practiceId: string
  patientId: string
  policy: {
    id: string
    subscriberIsPatient: boolean
    subscriberFirstName?: string | null
    subscriberLastName?: string | null
    subscriberDob?: Date | string | null
  }
}): Promise<Date | null> {
  if (params.policy.subscriberIsPatient) return null
  if (params.policy.subscriberDob) {
    return params.policy.subscriberDob instanceof Date
      ? params.policy.subscriberDob
      : new Date(params.policy.subscriberDob)
  }

  const dob = await findSubscriberDobInPractice({
    practiceId: params.practiceId,
    excludePatientId: params.patientId,
    firstName: params.policy.subscriberFirstName,
    lastName: params.policy.subscriberLastName,
  })
  if (!dob) return null

  await prisma.insurancePolicy.update({
    where: { id: params.policy.id },
    data: { subscriberDob: dob },
  })
  return dob
}
