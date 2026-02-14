/**
 * MCP data access (read-only). Uses main app Prisma.
 */
import { prisma } from '@/lib/db'

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (year < 1900 || year > 2100) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  const dt = new Date(Date.UTC(year, month - 1, day))
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null
  }
  return dt.toISOString().slice(0, 10)
}

function normalizeDobCandidates(rawDob: string): string[] {
  const value = rawDob.trim()
  const candidates = new Set<string>()
  const addWithNeighborDays = (isoDate: string) => {
    candidates.add(isoDate)
    const base = new Date(`${isoDate}T00:00:00.000Z`)
    if (Number.isNaN(base.getTime())) return
    const prev = new Date(base)
    prev.setUTCDate(prev.getUTCDate() - 1)
    const next = new Date(base)
    next.setUTCDate(next.getUTCDate() + 1)
    candidates.add(prev.toISOString().slice(0, 10))
    candidates.add(next.toISOString().slice(0, 10))
  }

  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const normalized = toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]))
    if (normalized) addWithNeighborDays(normalized)
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const first = Number(slashMatch[1])
    const second = Number(slashMatch[2])
    const year = Number(slashMatch[3])

    // Prefer US format (MM/DD/YYYY), but also try DD/MM/YYYY for ambiguous values.
    const us = toIsoDate(year, first, second)
    if (us) addWithNeighborDays(us)

    const international = toIsoDate(year, second, first)
    if (international) addWithNeighborDays(international)
  }

  // Final fallback for uncommon formats accepted by the JS runtime.
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    addWithNeighborDays(parsed.toISOString().slice(0, 10))
  }

  return Array.from(candidates)
}

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
  const firstName = params.firstName.trim()
  const lastName = params.lastName.trim()
  const dobCandidates = normalizeDobCandidates(params.dob)
  if (dobCandidates.length === 0) return []

  const where: {
    deletedAt: null
    OR?: Array<
      | {
          firstName: { equals: string; mode: 'insensitive' }
          lastName: { equals: string; mode: 'insensitive' }
        }
      | {
          AND: Array<{ name: { contains: string; mode: 'insensitive' } }>
        }
    >
    dateOfBirth?: { not: null }
    postalCode?: string
  } = {
    deletedAt: null,
    dateOfBirth: { not: null },
  }
  where.OR = [
    {
      firstName: { equals: firstName, mode: 'insensitive' },
      lastName: { equals: lastName, mode: 'insensitive' },
    },
    {
      AND: [
        { name: { contains: firstName, mode: 'insensitive' } },
        { name: { contains: lastName, mode: 'insensitive' } },
      ],
    },
  ]
  if (params.zip?.trim()) {
    where.postalCode = params.zip.trim()
  }

  const patients = await prisma.patient.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true, postalCode: true },
    take: 100,
  })

  const matched = patients.filter((p) => {
    if (!p.dateOfBirth) return false
    const storedDob = p.dateOfBirth.toISOString().slice(0, 10)
    return dobCandidates.includes(storedDob)
  })

  type Row = (typeof patients)[number]
  return matched.map((p: Row) => ({
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
