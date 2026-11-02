import { prisma } from '@/lib/db'
import { listNexhealthPatients } from './client'
import { asNexhealthEnvironment } from './connection'
import type { NexHealthConnection } from '@prisma/client'
import {
  buildNexhealthPatientMergeFilters,
  isNexhealthPlaceholderPatient,
  mapNexhealthPatient,
  type MappedNexhealthPatient,
} from './mapping'
import type { NexhealthPatient } from './types'

type UpsertOutcome = 'created' | 'updated' | 'linked' | 'restored' | 'skipped'

function patientUpdateFromMapped(
  existing: {
    firstName: string | null
    lastName: string | null
    name: string
    dateOfBirth: Date | null
    gender: string | null
    primaryPhone: string | null
    secondaryPhone: string | null
    phone: string
    email: string | null
    addressLine1: string | null
    addressLine2: string | null
    address: string | null
    city: string | null
    state: string | null
    postalCode: string | null
    ehrActive: boolean | null
  },
  mapped: MappedNexhealthPatient
) {
  return {
    deletedAt: null,
    firstName: mapped.firstName ?? existing.firstName,
    lastName: mapped.lastName ?? existing.lastName,
    name: mapped.name || existing.name,
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
    ehrActive: mapped.ehrActive ?? existing.ehrActive,
  }
}

export async function upsertPatientFromNexhealth(params: {
  practiceId: string
  patient: NexhealthPatient
}): Promise<{ id: string | null; outcome: UpsertOutcome }> {
  if (isNexhealthPlaceholderPatient(params.patient)) {
    return { id: null, outcome: 'skipped' }
  }
  const mapped = mapNexhealthPatient(params.patient)
  const { practiceId } = params

  const linked = await prisma.patient.findFirst({
    where: { practiceId, externalEhrId: mapped.externalEhrId },
    orderBy: { deletedAt: 'asc' },
  })
  if (linked) {
    const wasDeleted = linked.deletedAt != null
    await prisma.patient.update({
      where: { id: linked.id },
      data: patientUpdateFromMapped(linked, mapped),
    })
    return { id: linked.id, outcome: wasDeleted ? 'restored' : 'updated' }
  }

  const mergeOrConditions = buildNexhealthPatientMergeFilters(mapped)
  if (mergeOrConditions.length > 0) {
    const mergeCandidate = await prisma.patient.findFirst({
      where: {
        practiceId,
        deletedAt: null,
        externalEhrId: null,
        OR: mergeOrConditions as never,
      },
      orderBy: { updatedAt: 'desc' },
    })
    if (mergeCandidate) {
      await prisma.patient.update({
        where: { id: mergeCandidate.id },
        data: {
          externalEhrId: mapped.externalEhrId,
          firstName: mapped.firstName || mergeCandidate.firstName,
          lastName: mapped.lastName || mergeCandidate.lastName,
          name: mapped.name || mergeCandidate.name,
          dateOfBirth: mapped.dateOfBirth || mergeCandidate.dateOfBirth,
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
          ehrActive: mapped.ehrActive ?? mergeCandidate.ehrActive,
          consentSource: mergeCandidate.consentSource || 'import',
        },
      })
      return { id: mergeCandidate.id, outcome: 'linked' }
    }
  }

  const created = await prisma.patient.create({
    data: {
      practiceId,
      externalEhrId: mapped.externalEhrId,
      name: mapped.name,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
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
      ehrActive: mapped.ehrActive,
      consentSource: 'import',
    },
  })
  return { id: created.id, outcome: 'created' }
}

export type NexhealthPatientSyncSummary = {
  fetched: number
  created: number
  updated: number
  linked: number
  restored: number
  skipped: number
  errors: number
  errorSamples: string[]
}

export async function syncNexhealthPatients(params: {
  connection: NexHealthConnection
  updatedSince?: string | null
}): Promise<NexhealthPatientSyncSummary> {
  const { connection } = params
  const summary: NexhealthPatientSyncSummary = {
    fetched: 0,
    created: 0,
    updated: 0,
    linked: 0,
    restored: 0,
    skipped: 0,
    errors: 0,
    errorSamples: [],
  }
  const patients = await listNexhealthPatients(asNexhealthEnvironment(connection.environment), {
    subdomain: connection.subdomain,
    location_id: connection.locationId,
    ...(params.updatedSince ? { updated_since: params.updatedSince } : {}),
  })
  for (const patient of patients) {
    summary.fetched += 1
    try {
      const result = await upsertPatientFromNexhealth({
        practiceId: connection.practiceId,
        patient,
      })
      summary[result.outcome] += 1
    } catch (error) {
      summary.errors += 1
      if (summary.errorSamples.length < 5) {
        summary.errorSamples.push(
          error instanceof Error ? error.message : `Failed to upsert patient ${patient.id}`
        )
      }
    }
  }
  return summary
}
