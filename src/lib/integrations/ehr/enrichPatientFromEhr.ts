import { prisma } from '@/lib/db'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import { syncPatientDemographicsFromEhr } from '@/lib/integrations/ehr/patientUpdate'
import { syncPatientInsuranceFromEhr } from '@/lib/ehr/syncPatientInsuranceFromEhr'

export type EnrichPatientSource = 'call' | 'schedule_sync' | 'manual'

export type EnrichPatientResult =
  | {
      status: 'success'
      demographics: Awaited<ReturnType<typeof syncPatientDemographicsFromEhr>>
      insurance: Awaited<ReturnType<typeof syncPatientInsuranceFromEhr>>
    }
  | { status: 'skipped'; reason: string }
  | { status: 'partial'; demographics: unknown; insurance: unknown; message?: string }

const DEFAULT_FRESHNESS_HOURS = 24

export async function enrichPatientFromEhr(params: {
  practiceId: string
  patientId: string
  actorUserId?: string
  source?: EnrichPatientSource
  skipIfFreshWithinHours?: number | null
  force?: boolean
}): Promise<EnrichPatientResult> {
  const {
    practiceId,
    patientId,
    actorUserId = 'system',
    source = 'manual',
    skipIfFreshWithinHours = DEFAULT_FRESHNESS_HOURS,
    force = false,
  } = params

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, practiceId, deletedAt: null },
    select: { id: true, externalEhrId: true, lastInsuranceVerifiedAt: true },
  })

  if (!patient) {
    return { status: 'skipped', reason: 'patient_not_found' }
  }

  if (!patient.externalEhrId?.trim()) {
    return { status: 'skipped', reason: 'patient_not_linked_to_ehr' }
  }

  if (!force && skipIfFreshWithinHours != null && skipIfFreshWithinHours > 0 && patient.lastInsuranceVerifiedAt) {
    const ageMs = Date.now() - patient.lastInsuranceVerifiedAt.getTime()
    if (ageMs < skipIfFreshWithinHours * 60 * 60 * 1000) {
      return { status: 'skipped', reason: 'recently_enriched' }
    }
  }

  const demographics = await syncPatientDemographicsFromEhr({
    practiceId,
    patientId,
    actorUserId,
  })

  const insurance = await syncPatientInsuranceFromEhr({
    practiceId,
    patientId,
    actorUserId,
  })

  const demographicsOk = demographics.status === 'success'
  const insuranceOk = insurance.status === 'success'

  await logEhrAudit({
    tenantId: practiceId,
    actorUserId: actorUserId !== 'system' ? actorUserId : null,
    action: 'EHR_PATIENT_ENRICH_COMPLETE',
    providerId: 'ecw_write',
    entity: 'Patient',
    entityId: patient.externalEhrId,
    metadata: {
      patientId,
      source,
      demographicsStatus: demographics.status,
      insuranceStatus: insurance.status,
      demographicsReason: demographics.status === 'skipped' ? demographics.reason : undefined,
      insuranceReason: insurance.status === 'skipped' ? insurance.reason : undefined,
      insuranceError: insurance.status === 'error' ? insurance.message : undefined,
    },
  })

  if (demographicsOk && insuranceOk) {
    return { status: 'success', demographics, insurance }
  }

  if (demographics.status === 'skipped' && insurance.status === 'skipped') {
    return {
      status: 'skipped',
      reason: demographics.reason === 'missing_ehr_id' ? demographics.reason : insurance.reason,
    }
  }

  return {
    status: 'partial',
    demographics,
    insurance,
    message: !insuranceOk && insurance.status === 'error' ? insurance.message : undefined,
  }
}
