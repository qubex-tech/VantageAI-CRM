/**
 * Live EHR/EMR demographic lookup for voice tools.
 *
 * Always query Open Dental or eCW first, upsert hits into the CRM in real time,
 * then return CRM patient ids. CRM-only search is a fallback when the EHR is
 * not configured, errors, or has no match (portal-only charts).
 */

import { prisma } from '@/lib/db'
import type { Patient as OdPatient } from '@vantage/opendental-sdk'
import { getOpenDentalConnection, getOpenDentalServices } from '@/lib/integrations/opendental/factory'
import {
  isOpenDentalPatientActive,
  mapOpenDentalPatient,
  upsertPatientFromOpenDental,
} from '@/lib/integrations/opendental/patientSync'
import { createEhrClientForPractice } from '@/lib/integrations/ehr/scheduleSync'
import {
  upsertFhirPatientForPractice,
  type FhirPatient,
} from '@/lib/integrations/ehr/ecwPatientRosterSync'

export type DemographicMatch = {
  patient_id: string
  confidence: 'high' | 'medium'
  display: {
    first_name?: string
    last_name?: string
    dob?: string
    zip_masked?: string
  }
}

type CrmDemographicRow = {
  id: string
  firstName: string | null
  lastName: string | null
  dateOfBirth: Date | null
  postalCode: string | null
}

export function firstNameSearchVariants(firstName: string): string[] {
  const trimmed = firstName.trim().replace(/\s+/g, ' ')
  if (!trimmed) return []
  const firstToken = trimmed.split(' ')[0] ?? trimmed
  if (firstToken.toLowerCase() === trimmed.toLowerCase()) return [trimmed]
  return [trimmed, firstToken]
}

export function normalizeZipDigits(zip: string | null | undefined): string | null {
  if (!zip) return null
  const digits = zip.replace(/\D/g, '')
  if (digits.length < 5) return null
  return digits.slice(0, 5)
}

/** Prefer ZIP matches when any exist; never drop name+DOB hits that have a blank ZIP. */
export function preferZipMatches<T extends { postalCode?: string | null }>(
  rows: T[],
  zip?: string | null
): T[] {
  const want = normalizeZipDigits(zip)
  if (!want) return rows
  const matched = rows.filter((row) => normalizeZipDigits(row.postalCode) === want)
  return matched.length ? matched : rows
}

export function openDentalBirthdateMatches(birthdate: unknown, dobCandidates: string[]): boolean {
  if (typeof birthdate !== 'string') return false
  const datePart = birthdate.slice(0, 10)
  if (datePart.startsWith('0001-01-01')) return false
  return dobCandidates.includes(datePart)
}

export function fhirBirthdateMatches(birthDate: string | undefined, dobCandidates: string[]): boolean {
  if (!birthDate) return false
  return dobCandidates.includes(birthDate.slice(0, 10))
}

export function extractFhirPatientsFromBundle(bundle: unknown): FhirPatient[] {
  if (!bundle || typeof bundle !== 'object') return []
  const entry = (bundle as { entry?: unknown }).entry
  if (!Array.isArray(entry)) return []
  const out: FhirPatient[] = []
  for (const item of entry) {
    const resource =
      item && typeof item === 'object' ? (item as { resource?: FhirPatient }).resource : undefined
    if (resource?.resourceType === 'Patient' && resource.id) {
      out.push(resource)
    }
  }
  return out
}

export function toDemographicMatches(rows: CrmDemographicRow[], zip?: string | null): DemographicMatch[] {
  const ranked = preferZipMatches(rows, zip)
  const wantZip = normalizeZipDigits(zip)
  return ranked.map((row) => {
    const zipMatches = Boolean(wantZip && normalizeZipDigits(row.postalCode) === wantZip)
    return {
      patient_id: row.id,
      confidence: zipMatches ? 'high' : 'medium',
      display: {
        first_name: row.firstName ?? undefined,
        last_name: row.lastName ?? undefined,
        dob: row.dateOfBirth?.toISOString().slice(0, 10),
        zip_masked: row.postalCode ? `****${row.postalCode.slice(-4)}` : undefined,
      },
    }
  })
}

function asOdPatientList(value: unknown): OdPatient[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (row): row is OdPatient => Boolean(row && typeof row === 'object' && 'PatNum' in row)
  )
}

async function loadCrmRowsByIds(ids: string[]): Promise<CrmDemographicRow[]> {
  if (ids.length === 0) return []
  return prisma.patient.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true, postalCode: true },
  })
}

async function searchAndUpsertOpenDental(params: {
  practiceId: string
  firstName: string
  lastName: string
  dobCandidates: string[]
}): Promise<CrmDemographicRow[] | null> {
  const connection = await getOpenDentalConnection(params.practiceId)
  if (!connection?.isActive) return null

  const services = await getOpenDentalServices(params.practiceId)
  const firstVariants = firstNameSearchVariants(params.firstName)
  const primaryDob = params.dobCandidates[0]
  const seen = new Map<number, OdPatient>()

  const runList = async (query: Record<string, string>) => {
    const rows = asOdPatientList(await services.patients.list(query))
    for (const row of rows) {
      if (!row.PatNum || !isOpenDentalPatientActive(row)) continue
      if (!openDentalBirthdateMatches(row.Birthdate, params.dobCandidates)) continue
      seen.set(Number(row.PatNum), row)
    }
  }

  for (const fname of firstVariants) {
    if (primaryDob) {
      await runList({ LName: params.lastName, FName: fname, Birthdate: primaryDob })
    }
    if (seen.size === 0) {
      await runList({ LName: params.lastName, FName: fname })
    }
    if (seen.size > 0) break
  }

  const ids: string[] = []
  for (const od of seen.values()) {
    const mapped = mapOpenDentalPatient(od)
    const { id } = await upsertPatientFromOpenDental({ practiceId: params.practiceId, mapped })
    ids.push(id)
  }

  console.info('[voice-ehr] live Open Dental demographic resolve', {
    practiceId: params.practiceId,
    found: seen.size,
    upserted: ids.length,
  })

  return loadCrmRowsByIds(ids)
}

async function searchAndUpsertEcw(params: {
  practiceId: string
  firstName: string
  lastName: string
  dobCandidates: string[]
}): Promise<CrmDemographicRow[] | null> {
  const ehr = await createEhrClientForPractice(params.practiceId, { timeoutMs: 15_000 })
  if (!ehr) return null

  const firstVariants = firstNameSearchVariants(params.firstName)
  const primaryDob = params.dobCandidates[0]
  const seen = new Map<string, FhirPatient>()

  const queries: Array<Record<string, string>> = []
  for (const fname of firstVariants) {
    if (primaryDob) {
      queries.push({ family: params.lastName, given: fname, birthdate: primaryDob })
      queries.push({ name: `${fname} ${params.lastName}`.trim(), birthdate: primaryDob })
    }
  }

  for (const query of queries) {
    try {
      const bundle = await ehr.client.searchPatients(query)
      for (const patient of extractFhirPatientsFromBundle(bundle)) {
        if (!fhirBirthdateMatches(patient.birthDate, params.dobCandidates)) continue
        if (patient.id) seen.set(patient.id, patient)
      }
    } catch (error) {
      console.warn('[voice-ehr] eCW patient search failed', {
        practiceId: params.practiceId,
        query,
        error: error instanceof Error ? error.message : 'unknown',
      })
    }
    if (seen.size > 0) break
  }

  const ids: string[] = []
  for (const patient of seen.values()) {
    const outcome = await upsertFhirPatientForPractice(params.practiceId, patient)
    if (outcome === 'error' || !patient.id) continue
    const row = await prisma.patient.findFirst({
      where: { practiceId: params.practiceId, externalEhrId: patient.id, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true, postalCode: true },
    })
    if (row) ids.push(row.id)
  }

  console.info('[voice-ehr] live eCW demographic resolve', {
    practiceId: params.practiceId,
    found: seen.size,
    upserted: ids.length,
  })

  return loadCrmRowsByIds(ids)
}

export async function resolvePatientsFromLiveEhr(params: {
  practiceId: string
  firstName: string
  lastName: string
  dobCandidates: string[]
  zip?: string | null
}): Promise<DemographicMatch[]> {
  const firstName = params.firstName.trim()
  const lastName = params.lastName.trim()
  if (!firstName || !lastName || params.dobCandidates.length === 0) return []

  try {
    const odRows = await searchAndUpsertOpenDental({
      practiceId: params.practiceId,
      firstName,
      lastName,
      dobCandidates: params.dobCandidates,
    })
    if (odRows) {
      return toDemographicMatches(odRows, params.zip)
    }
  } catch (error) {
    console.warn('[voice-ehr] Open Dental demographic resolve failed', {
      practiceId: params.practiceId,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }

  try {
    const ecwRows = await searchAndUpsertEcw({
      practiceId: params.practiceId,
      firstName,
      lastName,
      dobCandidates: params.dobCandidates,
    })
    if (ecwRows) {
      return toDemographicMatches(ecwRows, params.zip)
    }
  } catch (error) {
    console.warn('[voice-ehr] eCW demographic resolve failed', {
      practiceId: params.practiceId,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }

  return []
}
