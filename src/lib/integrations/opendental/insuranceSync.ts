import { prisma } from '@/lib/db'
import { createTimelineEntry } from '@/lib/audit'
import { normalizePhoneForDialing } from '@/lib/phone'
import { extractPatNumFromExternalId } from './commlogWriteback'
import { getOpenDentalClient, getOpenDentalConnection, getOpenDentalServices } from './factory'
import { findSubscriberDobInPractice } from '@/lib/eligibility/resolve-subscriber-dob'

/** Denormalized row from GET /familymodules/{PatNum}/Insurance */
export type OpenDentalFamilyInsurance = {
  PatNum?: number | string
  InsSubNum?: number | string
  Subscriber?: number | string
  subscriber?: string
  SubscriberID?: string
  SubscNote?: string
  PatPlanNum?: number | string
  Ordinal?: number | string
  ordinal?: string
  IsPending?: string | boolean
  Relationship?: string
  PatID?: string
  CarrierNum?: number | string
  CarrierName?: string
  PlanNum?: number | string
  GroupName?: string
  GroupNum?: string
  PlanNote?: string
  PlanType?: string
  planType?: string
  EmployerNum?: number | string
  employer?: string
  IsMedical?: string | boolean
}

export type OpenDentalInsuranceCoverage = {
  patPlanNum: number
  memberId: string
  payerNameRaw: string
  insurerPhoneRaw: string | null
  groupNumber: string | null
  planName: string | null
  planType: string | null
  isPrimary: boolean
  subscriberIsPatient: boolean
  subscriberFirstName: string | null
  subscriberLastName: string | null
  subscriberPatNum: number | null
  relationshipToPatient: string | null
  availityPayerId: string | null
  isPending: boolean
  carrierNum: number | null
  insSubNum: number | null
  planNum: number | null
}

export type SyncOpenDentalInsuranceResult =
  | {
      status: 'success'
      syncedCount: number
      policies: Array<{ id: string; payerNameRaw: string; memberId: string; isPrimary: boolean }>
      insuranceStatus: string
      coveragesFromEhr: OpenDentalInsuranceCoverage[]
    }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; message: string }

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const trimmed = String(value).trim()
  return trimmed.length ? trimmed : null
}

function asNumber(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  return false
}

function splitSubscriberName(raw: string | null): { firstName: string | null; lastName: string | null } {
  if (!raw) return { firstName: null, lastName: null }
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: null, lastName: null }
  if (parts.length === 1) return { firstName: parts[0], lastName: null }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}

/** Map OD Relationship values onto CRM relationship labels. */
export function mapOpenDentalRelationship(relationship: string | null | undefined): string | null {
  const raw = cleanString(relationship)
  if (!raw) return null
  const normalized = raw.toLowerCase()
  if (normalized === 'self') return null
  if (normalized === 'spouse') return 'Spouse'
  if (normalized === 'child') return 'Child'
  return 'Other'
}

/** Map OD PlanType codes to CRM planType strings used by the insurance UI. */
export function mapOpenDentalPlanType(planTypeCode: string | null | undefined, planTypeLabel?: string | null): string | null {
  const code = (planTypeCode ?? '').trim().toLowerCase()
  if (code === 'p') return 'PPO'
  if (code === 'f') return 'Other'
  if (code === 'c') return 'HMO'
  const label = (planTypeLabel || '').toLowerCase()
  if (/ppo/.test(label)) return 'PPO'
  if (/hmo|capitation/.test(label)) return 'HMO'
  if (/medicare/.test(label)) return 'Medicare'
  if (/medicaid/.test(label)) return 'Medicaid'
  if (code === '' && !planTypeLabel) return null
  return 'Other'
}

export function resolveOpenDentalMemberId(row: OpenDentalFamilyInsurance): string | null {
  const patId = cleanString(row.PatID)
  if (patId) return patId
  const subscriberId = cleanString(row.SubscriberID)
  if (subscriberId) return subscriberId
  const patPlanNum = asNumber(row.PatPlanNum)
  if (patPlanNum != null) return `OD-PATPLAN-${patPlanNum}`
  return null
}

export function mapOpenDentalFamilyInsuranceRow(
  row: OpenDentalFamilyInsurance,
  extras?: { phone?: string | null; electId?: string | null }
): OpenDentalInsuranceCoverage | null {
  const patPlanNum = asNumber(row.PatPlanNum)
  if (patPlanNum == null) return null

  const memberId = resolveOpenDentalMemberId(row)
  if (!memberId) return null

  const relationship = cleanString(row.Relationship)
  const subscriberIsPatient = (relationship || '').toLowerCase() === 'self'
  const { firstName, lastName } = splitSubscriberName(cleanString(row.subscriber))
  const ordinal = asNumber(row.Ordinal)
  const ordinalLabel = cleanString(row.ordinal)?.toLowerCase()
  const isPrimary = ordinal === 1 || ordinalLabel === 'primary'

  const groupName = cleanString(row.GroupName)
  const employer = cleanString(row.employer)
  const planTypeLabel = cleanString(row.planType)
  const planName = groupName || employer || planTypeLabel || null

  return {
    patPlanNum,
    memberId,
    payerNameRaw: cleanString(row.CarrierName) || 'Unknown payer',
    insurerPhoneRaw: cleanString(extras?.phone) || null,
    groupNumber: cleanString(row.GroupNum),
    planName,
    planType: mapOpenDentalPlanType(cleanString(row.PlanType), planTypeLabel),
    isPrimary,
    subscriberIsPatient,
    subscriberFirstName: subscriberIsPatient ? null : firstName,
    subscriberLastName: subscriberIsPatient ? null : lastName,
    subscriberPatNum: subscriberIsPatient ? null : asNumber(row.Subscriber),
    relationshipToPatient: subscriberIsPatient ? null : mapOpenDentalRelationship(relationship),
    availityPayerId: cleanString(extras?.electId),
    isPending: asBool(row.IsPending),
    carrierNum: asNumber(row.CarrierNum),
    insSubNum: asNumber(row.InsSubNum),
    planNum: asNumber(row.PlanNum),
  }
}

function coverageToPolicyFields(
  coverage: OpenDentalInsuranceCoverage,
  practiceId: string,
  patientId: string,
  subscriberDob: Date | null
) {
  return {
    practiceId,
    patientId,
    payerNameRaw: coverage.payerNameRaw,
    insurerPhoneRaw: coverage.insurerPhoneRaw,
    insurerPhoneNormalized: normalizePhoneForDialing(coverage.insurerPhoneRaw),
    memberId: coverage.memberId,
    groupNumber: coverage.groupNumber,
    planName: coverage.planName,
    planType: coverage.planType,
    isPrimary: coverage.isPrimary,
    subscriberIsPatient: coverage.subscriberIsPatient,
    subscriberFirstName: coverage.subscriberFirstName,
    subscriberLastName: coverage.subscriberLastName,
    subscriberDob,
    relationshipToPatient: coverage.relationshipToPatient,
    availityPayerId: coverage.availityPayerId,
  }
}

function mapInsuranceStatus(coverages: OpenDentalInsuranceCoverage[]): string {
  if (coverages.length === 0) return 'missing'
  if (coverages.some((c) => c.isPending)) return 'missing'
  return 'verified'
}

async function fetchFamilyInsuranceRows(practiceId: string, patNum: number): Promise<OpenDentalFamilyInsurance[]> {
  // Official API: GET /familymodules/{PatNum}/Insurance (SDK's /familymodules/insurance is incorrect).
  const client = await getOpenDentalClient(practiceId)
  const result = await client.get<OpenDentalFamilyInsurance[] | OpenDentalFamilyInsurance>(
    `familymodules/${patNum}/Insurance`
  )
  if (Array.isArray(result)) return result
  if (result && typeof result === 'object') return [result]
  return []
}

async function enrichCarrierDetails(
  practiceId: string,
  rows: OpenDentalFamilyInsurance[]
): Promise<Map<number, { phone: string | null; electId: string | null }>> {
  const carrierNums = [
    ...new Set(
      rows
        .map((r) => asNumber(r.CarrierNum))
        .filter((n): n is number => n != null && n > 0)
    ),
  ]
  const byCarrier = new Map<number, { phone: string | null; electId: string | null }>()
  if (carrierNums.length === 0) return byCarrier

  try {
    const services = await getOpenDentalServices(practiceId)
    await Promise.all(
      carrierNums.map(async (carrierNum) => {
        try {
          const carrier = (await services.carriers.get(carrierNum)) as Record<string, unknown> | null
          byCarrier.set(carrierNum, {
            phone: cleanString(carrier?.Phone),
            electId: cleanString(carrier?.ElectID),
          })
        } catch {
          // Carrier enrich is best-effort; FamilyModules already has CarrierName.
        }
      })
    )
  } catch {
    // Connection/services failure should not block policy sync from FamilyModules rows.
  }

  return byCarrier
}

/**
 * Pull insurance from Open Dental Family Module into CRM InsurancePolicy rows
 * so the existing patient Insurance tab can display them without UI changes.
 */
export async function syncOpenDentalInsuranceForPatient(params: {
  practiceId: string
  patientId: string
  externalEhrId?: string | null
  actorUserId?: string
}): Promise<SyncOpenDentalInsuranceResult> {
  const { practiceId, patientId, actorUserId } = params

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, practiceId, deletedAt: null },
    select: { id: true, externalEhrId: true },
  })
  if (!patient) {
    return { status: 'skipped', reason: 'patient_not_found' }
  }

  const externalEhrId = params.externalEhrId ?? patient.externalEhrId
  const patNum = extractPatNumFromExternalId(externalEhrId)
  if (patNum == null) {
    return { status: 'skipped', reason: 'patient_not_linked_to_opendental' }
  }

  const connection = await getOpenDentalConnection(practiceId)
  if (!connection?.isActive) {
    return { status: 'skipped', reason: 'opendental_not_configured' }
  }

  let rows: OpenDentalFamilyInsurance[]
  try {
    rows = await fetchFamilyInsuranceRows(practiceId, patNum)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'opendental_insurance_fetch_failed'
    return { status: 'error', message }
  }

  const carrierExtras = await enrichCarrierDetails(practiceId, rows)
  const coverages = rows
    .map((row) => {
      const carrierNum = asNumber(row.CarrierNum)
      const extras = carrierNum != null ? carrierExtras.get(carrierNum) : undefined
      return mapOpenDentalFamilyInsuranceRow(row, extras)
    })
    .filter((c): c is OpenDentalInsuranceCoverage => c != null)

  const subscriberDobs = new Map<string, Date | null>()
  await Promise.all(
    coverages.map(async (coverage) => {
      if (coverage.subscriberIsPatient) {
        subscriberDobs.set(coverage.memberId, null)
        return
      }
      const dob = await findSubscriberDobInPractice({
        practiceId,
        excludePatientId: patientId,
        firstName: coverage.subscriberFirstName,
        lastName: coverage.subscriberLastName,
        subscriberPatNum: coverage.subscriberPatNum,
      })
      subscriberDobs.set(coverage.memberId, dob)
    })
  )

  if (coverages.length === 0) {
    await prisma.patient.update({
      where: { id: patientId },
      data: {
        insuranceStatus: 'missing',
        lastInsuranceVerifiedAt: new Date(),
        selfPay: true,
      },
    })
    await createTimelineEntry({
      patientId,
      type: 'insurance',
      title: 'Insurance synced from Open Dental',
      description: 'No coverage returned from Open Dental',
      metadata: {
        source: 'opendental',
        syncedCount: 0,
        actorUserId: actorUserId || null,
        patNum,
      },
    })
    return {
      status: 'success',
      syncedCount: 0,
      policies: [],
      insuranceStatus: 'missing',
      coveragesFromEhr: [],
    }
  }

  const upserted: Array<{ id: string; payerNameRaw: string; memberId: string; isPrimary: boolean }> = []

  await prisma.$transaction(async (tx) => {
    const memberIds = coverages.map((c) => c.memberId)
    const existing = await tx.insurancePolicy.findMany({
      where: { patientId, practiceId, memberId: { in: memberIds } },
    })
    const byMemberId = new Map(existing.map((p) => [p.memberId, p]))

    for (const coverage of coverages) {
      const data = coverageToPolicyFields(
        coverage,
        practiceId,
        patientId,
        subscriberDobs.get(coverage.memberId) ?? null
      )
      const match = byMemberId.get(coverage.memberId)

      if (match) {
        const updated = await tx.insurancePolicy.update({
          where: { id: match.id },
          data: {
            payerNameRaw: data.payerNameRaw,
            insurerPhoneRaw: data.insurerPhoneRaw,
            insurerPhoneNormalized: data.insurerPhoneNormalized,
            groupNumber: data.groupNumber,
            planName: data.planName,
            planType: data.planType,
            isPrimary: data.isPrimary,
            subscriberIsPatient: data.subscriberIsPatient,
            subscriberFirstName: data.subscriberFirstName,
            subscriberLastName: data.subscriberLastName,
            subscriberDob: data.subscriberDob ?? match.subscriberDob,
            relationshipToPatient: data.relationshipToPatient,
            availityPayerId: data.availityPayerId ?? match.availityPayerId,
          },
        })
        upserted.push({
          id: updated.id,
          payerNameRaw: updated.payerNameRaw,
          memberId: updated.memberId,
          isPrimary: updated.isPrimary,
        })
      } else {
        const created = await tx.insurancePolicy.create({ data })
        upserted.push({
          id: created.id,
          payerNameRaw: created.payerNameRaw,
          memberId: created.memberId,
          isPrimary: created.isPrimary,
        })
      }
    }

    const primary = upserted.find((p) => p.isPrimary) || upserted[0]
    const insuranceStatus = mapInsuranceStatus(coverages)

    await tx.patient.update({
      where: { id: patientId },
      data: {
        primaryInsuranceId: primary?.id ?? null,
        insuranceStatus,
        lastInsuranceVerifiedAt: new Date(),
        selfPay: false,
      },
    })

    if (upserted.some((p) => p.isPrimary)) {
      await tx.insurancePolicy.updateMany({
        where: {
          patientId,
          practiceId,
          id: { notIn: upserted.filter((p) => p.isPrimary).map((p) => p.id) },
          isPrimary: true,
        },
        data: { isPrimary: false },
      })
    }
  })

  const primaryPolicy = upserted.find((p) => p.isPrimary) || upserted[0]
  const insuranceStatus = mapInsuranceStatus(coverages)

  await createTimelineEntry({
    patientId,
    type: 'insurance',
    title: 'Insurance synced from Open Dental',
    description: primaryPolicy
      ? `${primaryPolicy.payerNameRaw} – Member ****${primaryPolicy.memberId.slice(-4)}`
      : 'No coverage returned from Open Dental',
    metadata: {
      source: 'opendental',
      syncedCount: upserted.length,
      actorUserId: actorUserId || null,
      patNum,
      patPlanNums: coverages.map((c) => c.patPlanNum),
    },
  })

  return {
    status: 'success',
    syncedCount: upserted.length,
    policies: upserted,
    insuranceStatus,
    coveragesFromEhr: coverages,
  }
}
