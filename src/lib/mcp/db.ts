/**
 * MCP data access (read-only). Uses main app Prisma.
 */
import { prisma } from '@/lib/db'

export async function getPatientById(patientId: string) {
  return prisma.patient.findFirst({
    where: { id: patientId, deletedAt: null },
    select: {
      id: true,
      practiceId: true,
      name: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      primaryPhone: true,
      phone: true,
      email: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
    },
  })
}

export async function getInsurancePoliciesByPatientId(patientId: string) {
  return prisma.insurancePolicy.findMany({
    where: { patientId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function getInsurancePolicyById(policyId: string) {
  return prisma.insurancePolicy.findFirst({
    where: { id: policyId },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          addressLine1: true,
          city: true,
          state: true,
          postalCode: true,
        },
      },
    },
  })
}

export async function getPrimaryPolicyForPatient(patientId: string) {
  return prisma.insurancePolicy.findFirst({
    where: { patientId, isPrimary: true },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          primaryPhone: true,
          phone: true,
          email: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
        },
      },
    },
  })
}

export async function searchPatientsByDemographics(params: {
  firstName: string
  lastName: string
  dob: string
  zip?: string
}) {
  const dob = new Date(params.dob)
  if (isNaN(dob.getTime())) return []
  const dobStart = new Date(dob)
  dobStart.setUTCHours(0, 0, 0, 0)
  const dobEnd = new Date(dobStart)
  dobEnd.setUTCDate(dobEnd.getUTCDate() + 1)

  const where: {
    deletedAt: null
    firstName?: { equals: string; mode: 'insensitive' }
    lastName?: { equals: string; mode: 'insensitive' }
    dateOfBirth: { gte: Date; lt: Date }
    postalCode?: string
  } = {
    deletedAt: null,
    dateOfBirth: { gte: dobStart, lt: dobEnd },
  }
  where.firstName = { equals: params.firstName.trim(), mode: 'insensitive' }
  where.lastName = { equals: params.lastName.trim(), mode: 'insensitive' }
  if (params.zip?.trim()) {
    where.postalCode = params.zip.trim()
  }

  const patients = await prisma.patient.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true, postalCode: true },
    take: 20,
  })

  type Row = (typeof patients)[number]
  return patients.map((p: Row) => ({
    patient_id: p.id,
    confidence: params.zip ? 'high' : 'medium',
    display: {
      first_name: p.firstName ?? undefined,
      last_name: p.lastName ?? undefined,
      dob: p.dateOfBirth?.toISOString().slice(0, 10),
      zip_masked: p.postalCode ? `****${p.postalCode.slice(-4)}` : undefined,
    },
  }))
}
