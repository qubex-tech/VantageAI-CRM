import { prisma } from '@/lib/db'
import {
  fetchEcwPatientCoverages,
  isEcwDocumentationConfigured,
} from '@/lib/ehr/vantageEcwBackend'

function asDate(value?: Date | string | null): Date | null {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

function patientNameParts(patient: {
  firstName?: string | null
  lastName?: string | null
  name?: string | null
}): { firstName: string | null; lastName: string | null } {
  const first = patient.firstName?.trim() || null
  const last = patient.lastName?.trim() || null
  if (first || last) return { firstName: first, lastName: last }
  const full = patient.name?.trim()
  if (!full) return { firstName: null, lastName: null }
  const parts = full.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { firstName: parts[0], lastName: null }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

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

async function findUniqueHolderByMemberId(params: {
  practiceId: string
  excludePatientId: string
  memberId: string
}): Promise<{ firstName: string | null; lastName: string | null; dateOfBirth: Date | null } | null> {
  const memberId = params.memberId.trim()
  if (!memberId) return null

  const rows = await prisma.insurancePolicy.findMany({
    where: {
      practiceId: params.practiceId,
      memberId,
      subscriberIsPatient: true,
      patient: { deletedAt: null, id: { not: params.excludePatientId } },
    },
    select: {
      patient: {
        select: { firstName: true, lastName: true, name: true, dateOfBirth: true },
      },
    },
    take: 8,
  })

  const holders = rows
    .map((row) => {
      const names = patientNameParts(row.patient)
      return {
        firstName: names.firstName,
        lastName: names.lastName,
        dateOfBirth: row.patient.dateOfBirth,
      }
    })
    .filter((row) => row.firstName && row.lastName)

  if (holders.length === 0) return null
  const key = `${holders[0].firstName?.toLowerCase()}|${holders[0].lastName?.toLowerCase()}`
  if (holders.some((row) => `${row.firstName?.toLowerCase()}|${row.lastName?.toLowerCase()}` !== key)) {
    return null
  }
  return holders[0]
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
    return asDate(params.policy.subscriberDob)
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

export async function fillMissingSubscriberIdentity(params: {
  practiceId: string
  patientId: string
  externalEhrId?: string | null
  policy: {
    id: string
    memberId: string
    subscriberIsPatient: boolean
    subscriberFirstName?: string | null
    subscriberLastName?: string | null
    subscriberDob?: Date | string | null
    relationshipToPatient?: string | null
  }
}): Promise<{
  subscriberFirstName: string | null
  subscriberLastName: string | null
  subscriberDob: Date | null
  relationshipToPatient: string | null
}> {
  const empty = {
    subscriberFirstName: params.policy.subscriberFirstName?.trim() || null,
    subscriberLastName: params.policy.subscriberLastName?.trim() || null,
    subscriberDob: asDate(params.policy.subscriberDob),
    relationshipToPatient: params.policy.relationshipToPatient?.trim() || null,
  }
  if (params.policy.subscriberIsPatient) return empty

  let firstName = empty.subscriberFirstName
  let lastName = empty.subscriberLastName
  let dob = empty.subscriberDob
  let relationship = empty.relationshipToPatient

  if (!firstName || !lastName) {
    const holder = await findUniqueHolderByMemberId({
      practiceId: params.practiceId,
      excludePatientId: params.patientId,
      memberId: params.policy.memberId,
    })
    if (holder) {
      firstName = firstName || holder.firstName
      lastName = lastName || holder.lastName
      dob = dob || holder.dateOfBirth
    }
  }

  const ehrId = params.externalEhrId?.trim()
  const needsEhr =
    Boolean(ehrId) &&
    !ehrId.startsWith('opendental:') &&
    (!firstName || !lastName || !relationship)
  if (needsEhr && (await isEcwDocumentationConfigured(params.practiceId))) {
    try {
      const { coverages } = await fetchEcwPatientCoverages(ehrId, params.practiceId)
      const match =
        coverages.find((coverage) => coverage.memberId === params.policy.memberId) ||
        coverages.find((coverage) => coverage.isPrimary) ||
        coverages[0]
      if (match && !match.subscriberIsPatient) {
        firstName = firstName || match.subscriberFirstName?.trim() || null
        lastName = lastName || match.subscriberLastName?.trim() || null
        relationship = relationship || match.relationshipToPatient?.trim() || null
        if (!dob && match.subscriberDob) {
          dob = new Date(`${match.subscriberDob.slice(0, 10)}T00:00:00.000Z`)
        }
        if (match.subscriberPatientId && (!firstName || !lastName || !dob)) {
          const holder = await prisma.patient.findFirst({
            where: {
              practiceId: params.practiceId,
              deletedAt: null,
              id: { not: params.patientId },
              OR: [
                { externalEhrId: match.subscriberPatientId },
                { externalEhrId: `Patient/${match.subscriberPatientId}` },
              ],
            },
            select: { firstName: true, lastName: true, name: true, dateOfBirth: true },
          })
          if (holder) {
            const names = patientNameParts(holder)
            firstName = firstName || names.firstName
            lastName = lastName || names.lastName
            dob = dob || holder.dateOfBirth
          }
        }
      }
    } catch (error) {
      console.warn('[fillMissingSubscriberIdentity] eCW coverage lookup failed', {
        practiceId: params.practiceId,
        patientId: params.patientId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (firstName && lastName && !dob) {
    dob = await findSubscriberDobInPractice({
      practiceId: params.practiceId,
      excludePatientId: params.patientId,
      firstName,
      lastName,
    })
  }

  const changed =
    firstName !== empty.subscriberFirstName ||
    lastName !== empty.subscriberLastName ||
    (dob?.getTime() ?? null) !== (empty.subscriberDob?.getTime() ?? null) ||
    relationship !== empty.relationshipToPatient

  if (changed) {
    await prisma.insurancePolicy.update({
      where: { id: params.policy.id },
      data: {
        subscriberFirstName: firstName,
        subscriberLastName: lastName,
        subscriberDob: dob,
        relationshipToPatient: relationship,
      },
    })
  }

  return {
    subscriberFirstName: firstName,
    subscriberLastName: lastName,
    subscriberDob: dob,
    relationshipToPatient: relationship,
  }
}
