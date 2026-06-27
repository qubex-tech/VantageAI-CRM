import { prisma } from '@/lib/db'
import type { Patient as OdPatient } from '@vantage/opendental-sdk'
import { getOpenDentalServices } from './factory'
import { recordSyncResult } from './connectionManager'
import { logOpenDentalAudit } from './audit'

/** Namespace prefix so Open Dental IDs never collide with FHIR `externalEhrId` values. */
export const OPEN_DENTAL_EXTERNAL_PREFIX = 'opendental:'

export function buildExternalId(patNum: number | string): string {
  return `${OPEN_DENTAL_EXTERNAL_PREFIX}${patNum}`
}

type MappedPatient = {
  externalEhrId: string
  name: string
  firstName: string | null
  lastName: string | null
  preferredName: string | null
  dateOfBirth: Date | null
  gender: string | null
  primaryPhone: string | null
  secondaryPhone: string | null
  email: string | null
  addressLine1: string | null
  addressLine2: string | null
  address: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  preferredContactMethod: string
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function parseOdDate(value: unknown): Date | null {
  const raw = cleanString(value)
  if (!raw) return null
  // Open Dental returns 0001-01-01 (and similar) for unset dates.
  if (raw.startsWith('0001-01-01')) return null
  const datePart = raw.slice(0, 10)
  const parsed = new Date(`${datePart}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function normalizeGender(value: unknown): string | null {
  const raw = cleanString(value)?.toLowerCase()
  if (!raw) return null
  if (raw === 'male') return 'male'
  if (raw === 'female') return 'female'
  if (raw === 'unknown') return 'unknown'
  return 'other'
}

export function mapOpenDentalPatient(od: OdPatient): MappedPatient {
  const firstName = cleanString(od.FName)
  const lastName = cleanString(od.LName)
  const middle = cleanString(od.MiddleI)
  const nameParts = [firstName, middle, lastName].filter(Boolean)
  const name = nameParts.join(' ').trim() || `Open Dental Patient ${od.PatNum}`

  const wireless = cleanString(od.WirelessPhone)
  const home = cleanString(od.HmPhone)
  const work = cleanString(od.WkPhone)
  const phonesInOrder = [wireless, home, work].filter(Boolean) as string[]
  const primaryPhone = phonesInOrder[0] ?? null
  const secondaryPhone = phonesInOrder.find((p) => p !== primaryPhone) ?? null

  const email = cleanString(od.Email)
  const addressLine1 = cleanString(od.Address)
  const addressLine2 = cleanString(od.Address2)
  const city = cleanString(od.City)
  const state = cleanString(od.State)
  const postalCode = cleanString(od.Zip)
  const addressDisplay =
    [addressLine1, addressLine2, [city, state].filter(Boolean).join(', '), postalCode]
      .filter(Boolean)
      .join(', ') || null

  return {
    externalEhrId: buildExternalId(od.PatNum),
    name,
    firstName,
    lastName,
    preferredName: cleanString(od.Preferred),
    dateOfBirth: parseOdDate(od.Birthdate),
    gender: normalizeGender(od.Gender),
    primaryPhone,
    secondaryPhone,
    email,
    addressLine1,
    addressLine2,
    address: addressDisplay,
    city,
    state,
    postalCode,
    preferredContactMethod: primaryPhone ? 'phone' : email ? 'email' : 'phone',
  }
}

type UpsertOutcome = 'created' | 'updated' | 'linked'

export async function upsertPatientFromOpenDental(params: {
  practiceId: string
  mapped: MappedPatient
}): Promise<{ id: string; outcome: UpsertOutcome }> {
  const { practiceId, mapped } = params

  const existing = await prisma.patient.findFirst({
    where: {
      practiceId,
      deletedAt: null,
      externalEhrId: mapped.externalEhrId,
    },
  })

  if (existing) {
    await prisma.patient.update({
      where: { id: existing.id },
      data: {
        firstName: mapped.firstName ?? existing.firstName,
        lastName: mapped.lastName ?? existing.lastName,
        name: mapped.name || existing.name,
        preferredName: mapped.preferredName ?? existing.preferredName,
        dateOfBirth: mapped.dateOfBirth ?? existing.dateOfBirth,
        gender: mapped.gender ?? existing.gender,
        primaryPhone: mapped.primaryPhone ?? existing.primaryPhone,
        secondaryPhone: mapped.secondaryPhone ?? existing.secondaryPhone,
        phone: mapped.primaryPhone || existing.phone || 'unknown',
        email: mapped.email ?? existing.email,
        addressLine1: mapped.addressLine1 ?? existing.addressLine1,
        addressLine2: mapped.addressLine2 ?? existing.addressLine2,
        address: mapped.address ?? existing.address,
        city: mapped.city ?? existing.city,
        state: mapped.state ?? existing.state,
        postalCode: mapped.postalCode ?? existing.postalCode,
      },
    })
    return { id: existing.id, outcome: 'updated' }
  }

  // Try to merge into an existing unlinked CRM patient before creating a new record.
  const mergeOrConditions: Array<Record<string, unknown>> = []
  if (mapped.email) {
    mergeOrConditions.push({ email: { equals: mapped.email, mode: 'insensitive' } })
  }
  if (mapped.primaryPhone) {
    mergeOrConditions.push({ primaryPhone: mapped.primaryPhone })
    mergeOrConditions.push({ phone: mapped.primaryPhone })
  }
  if (mapped.name && mapped.dateOfBirth) {
    mergeOrConditions.push({
      AND: [
        { name: { equals: mapped.name, mode: 'insensitive' } },
        { dateOfBirth: mapped.dateOfBirth },
      ],
    })
  }

  if (mergeOrConditions.length > 0) {
    const mergeCandidate = await prisma.patient.findFirst({
      where: {
        practiceId,
        deletedAt: null,
        externalEhrId: null,
        OR: mergeOrConditions as any,
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (mergeCandidate) {
      const linked = await prisma.patient.update({
        where: { id: mergeCandidate.id },
        data: {
          externalEhrId: mapped.externalEhrId,
          firstName: mergeCandidate.firstName || mapped.firstName,
          lastName: mergeCandidate.lastName || mapped.lastName,
          name: mergeCandidate.name || mapped.name,
          preferredName: mergeCandidate.preferredName || mapped.preferredName,
          dateOfBirth: mergeCandidate.dateOfBirth || mapped.dateOfBirth,
          gender: mergeCandidate.gender || mapped.gender,
          primaryPhone: mergeCandidate.primaryPhone || mapped.primaryPhone,
          secondaryPhone: mergeCandidate.secondaryPhone || mapped.secondaryPhone,
          phone: mergeCandidate.phone || mapped.primaryPhone || 'unknown',
          email: mergeCandidate.email || mapped.email,
          addressLine1: mergeCandidate.addressLine1 || mapped.addressLine1,
          addressLine2: mergeCandidate.addressLine2 || mapped.addressLine2,
          address: mergeCandidate.address || mapped.address,
          city: mergeCandidate.city || mapped.city,
          state: mergeCandidate.state || mapped.state,
          postalCode: mergeCandidate.postalCode || mapped.postalCode,
          consentSource: mergeCandidate.consentSource || 'import',
        },
      })
      return { id: linked.id, outcome: 'linked' }
    }
  }

  const created = await prisma.patient.create({
    data: {
      practiceId,
      externalEhrId: mapped.externalEhrId,
      name: mapped.name,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      preferredName: mapped.preferredName,
      dateOfBirth: mapped.dateOfBirth,
      gender: mapped.gender,
      primaryPhone: mapped.primaryPhone,
      secondaryPhone: mapped.secondaryPhone,
      phone: mapped.primaryPhone || 'unknown',
      email: mapped.email,
      addressLine1: mapped.addressLine1,
      addressLine2: mapped.addressLine2,
      address: mapped.address,
      city: mapped.city,
      state: mapped.state,
      postalCode: mapped.postalCode,
      preferredContactMethod: mapped.preferredContactMethod,
      consentSource: 'import',
    },
  })
  return { id: created.id, outcome: 'created' }
}

/**
 * Resolve the CRM patient id for an Open Dental PatNum, fetching and creating the
 * patient record on demand if it has not been synced yet. Returns null if the
 * patient cannot be retrieved.
 */
export async function ensureCrmPatientIdForPatNum(params: {
  practiceId: string
  patNum: number
  services: Awaited<ReturnType<typeof getOpenDentalServices>>
  cache: Map<number, string>
}): Promise<string | null> {
  const { practiceId, patNum, services, cache } = params
  const cached = cache.get(patNum)
  if (cached) return cached

  const externalId = buildExternalId(patNum)
  const existing = await prisma.patient.findFirst({
    where: { practiceId, deletedAt: null, externalEhrId: externalId },
    select: { id: true },
  })
  if (existing) {
    cache.set(patNum, existing.id)
    return existing.id
  }

  try {
    const od = (await services.patients.get(patNum)) as OdPatient | null
    if (!od || !od.PatNum) return null
    const mapped = mapOpenDentalPatient(od)
    const { id } = await upsertPatientFromOpenDental({ practiceId, mapped })
    cache.set(patNum, id)
    return id
  } catch {
    return null
  }
}

export type PatientSyncSummary = {
  fetched: number
  created: number
  updated: number
  linked: number
  errors: number
  errorSamples: string[]
}

/**
 * Pull patients from Open Dental into the CRM patient table for a practice.
 *
 * @param since Optional ISO timestamp; when provided, only patients changed since
 *   then are fetched (Open Dental `DateTStamp` incremental filter).
 */
export async function syncOpenDentalPatients(params: {
  practiceId: string
  actorUserId?: string
  limit?: number
  maxPages?: number
  since?: string
}): Promise<PatientSyncSummary> {
  const { practiceId, actorUserId } = params
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 100)
  const maxPages = Math.min(Math.max(params.maxPages ?? 200, 1), 1000)

  const services = await getOpenDentalServices(practiceId)

  const summary: PatientSyncSummary = {
    fetched: 0,
    created: 0,
    updated: 0,
    linked: 0,
    errors: 0,
    errorSamples: [],
  }

  const baseParams: Record<string, string | number> = {}
  if (params.since) {
    const sinceDate = new Date(params.since)
    if (!Number.isNaN(sinceDate.getTime())) {
      baseParams.DateTStamp = sinceDate.toISOString().slice(0, 19).replace('T', ' ')
    }
  }

  try {
    let offset = 0
    for (let page = 0; page < maxPages; page++) {
      const batch = (await services.patients.list({
        ...baseParams,
        Limit: limit,
        Offset: offset,
      })) as OdPatient[]

      if (!Array.isArray(batch) || batch.length === 0) break

      for (const od of batch) {
        summary.fetched += 1
        try {
          const mapped = mapOpenDentalPatient(od)
          const { outcome } = await upsertPatientFromOpenDental({ practiceId, mapped })
          if (outcome === 'created') summary.created += 1
          else if (outcome === 'updated') summary.updated += 1
          else summary.linked += 1
        } catch (error) {
          summary.errors += 1
          if (summary.errorSamples.length < 5) {
            summary.errorSamples.push(error instanceof Error ? error.message : 'unknown error')
          }
        }
      }

      if (batch.length < limit) break
      offset += limit
    }

    await recordSyncResult(practiceId, {
      status: summary.errors > 0 && summary.created + summary.updated + summary.linked === 0 ? 'error' : 'success',
      error: summary.errorSamples[0],
    })

    await logOpenDentalAudit({
      tenantId: practiceId,
      actorUserId,
      action: 'patients.synced',
      entity: 'Patient',
      metadata: {
        fetched: summary.fetched,
        created: summary.created,
        updated: summary.updated,
        linked: summary.linked,
        errors: summary.errors,
      },
    })

    return summary
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Patient sync failed'
    await recordSyncResult(practiceId, { status: 'error', error: message })
    throw error
  }
}
