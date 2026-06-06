import { prisma } from '@/lib/db'
import { createTimelineEntry } from '@/lib/audit'
import { normalizePhoneForDialing } from '@/lib/phone'
import {
  fetchEcwPatientCoverages,
  isEcwDocumentationConfigured,
  type EcwPatientCoverage,
} from '@/lib/ehr/vantageEcwBackend'

function mapPlanType(coverageType?: string, planName?: string): string | null {
  const t = (coverageType || '').toUpperCase()
  if (t === 'CI' || /commercial/i.test(planName || '')) return 'Commercial'
  if (/medicare/i.test(planName || '') || t === 'MC') return 'Medicare'
  if (/medicaid/i.test(planName || '') || t === 'MD') return 'Medicaid'
  if (/hmo/i.test(planName || '')) return 'HMO'
  if (/ppo/i.test(planName || '')) return 'PPO'
  if (coverageType) return 'Other'
  return null
}

function mapInsuranceStatus(eligibilityStatus?: string): string {
  if (!eligibilityStatus) return 'missing'
  if (/^E\b|eligible/i.test(eligibilityStatus)) return 'verified'
  if (/not verified|unverified|^V\b/i.test(eligibilityStatus)) return 'missing'
  return 'missing'
}

function coverageToPolicyFields(coverage: EcwPatientCoverage, practiceId: string, patientId: string) {
  const payerName = coverage.payorName?.trim() || 'Unknown payer'
  const phone = coverage.payorPhone?.trim() || null
  return {
    practiceId,
    patientId,
    payerNameRaw: payerName,
    insurerPhoneRaw: phone,
    insurerPhoneNormalized: normalizePhoneForDialing(phone),
    memberId: coverage.memberId,
    groupNumber: coverage.groupNumber || null,
    planName: coverage.planName || coverage.planCode || null,
    planType: mapPlanType(coverage.coverageType, coverage.planName),
    isPrimary: coverage.isPrimary,
    subscriberIsPatient: coverage.subscriberIsPatient,
    subscriberFirstName: null as string | null,
    subscriberLastName: null as string | null,
    subscriberDob: null as Date | null,
    relationshipToPatient: coverage.subscriberIsPatient ? null : coverage.relationshipToPatient || null,
  }
}

export type SyncPatientInsuranceResult =
  | {
      status: 'success'
      syncedCount: number
      policies: Array<{ id: string; payerNameRaw: string; memberId: string; isPrimary: boolean }>
      insuranceStatus: string
      coveragesFromEhr: EcwPatientCoverage[]
    }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; message: string }

export async function syncPatientInsuranceFromEhr(params: {
  practiceId: string
  patientId: string
  actorUserId?: string
}): Promise<SyncPatientInsuranceResult> {
  const { practiceId, patientId, actorUserId } = params

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, practiceId, deletedAt: null },
    select: { id: true, externalEhrId: true, name: true },
  })

  if (!patient) {
    return { status: 'skipped', reason: 'patient_not_found' }
  }

  if (!patient.externalEhrId?.trim()) {
    return { status: 'skipped', reason: 'patient_not_linked_to_ehr' }
  }

  if (!(await isEcwDocumentationConfigured(practiceId))) {
    return { status: 'skipped', reason: 'ecw_not_configured' }
  }

  let coverages: EcwPatientCoverage[]
  try {
    const result = await fetchEcwPatientCoverages(patient.externalEhrId, practiceId)
    coverages = result.coverages
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ehr_fetch_failed'
    return { status: 'error', message }
  }

  if (coverages.length === 0) {
    await prisma.patient.update({
      where: { id: patientId },
      data: {
        insuranceStatus: 'missing',
        lastInsuranceVerifiedAt: new Date(),
        selfPay: true,
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
      const data = coverageToPolicyFields(coverage, practiceId, patientId)
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
            relationshipToPatient: data.relationshipToPatient,
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
    const primaryCoverage = coverages.find((c) => c.isPrimary) || coverages[0]
    const insuranceStatus = mapInsuranceStatus(primaryCoverage?.eligibilityStatus)

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
  const primaryCoverage = coverages.find((c) => c.isPrimary) || coverages[0]
  const insuranceStatus = mapInsuranceStatus(primaryCoverage?.eligibilityStatus)

  await createTimelineEntry({
    patientId,
    type: 'insurance',
    title: 'Insurance synced from eCW',
    description: primaryPolicy
      ? `${primaryPolicy.payerNameRaw} – Member ****${primaryPolicy.memberId.slice(-4)}`
      : 'No coverage returned from eCW',
    metadata: {
      source: 'ecw_fhir',
      syncedCount: upserted.length,
      actorUserId: actorUserId || null,
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
