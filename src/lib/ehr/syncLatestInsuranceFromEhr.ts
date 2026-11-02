import { syncPatientInsuranceFromEhr } from '@/lib/ehr/syncPatientInsuranceFromEhr'
import { syncOpenDentalInsuranceForPatient } from '@/lib/integrations/opendental/insuranceSync'
import { OPEN_DENTAL_EXTERNAL_PREFIX } from '@/lib/integrations/opendental/patientSync'
import { NEXHEALTH_PATIENT_PREFIX } from '@/lib/integrations/nexhealth/mapping'

export type EhrInsuranceSyncSummary = {
  source: 'opendental' | 'ecw' | 'nexhealth' | null
  status: 'success' | 'skipped' | 'error'
  reason?: string
  message?: string
  syncedCount?: number
}

/**
 * Refresh CRM insurance policies from the patient's linked EHR before eligibility.
 * Open Dental patients use the Family Module pull. Other linked charts use eCW FHIR.
 */
export async function syncLatestInsuranceFromEhr(params: {
  practiceId: string
  patientId: string
  externalEhrId?: string | null
  actorUserId?: string
}): Promise<EhrInsuranceSyncSummary> {
  const externalEhrId = params.externalEhrId?.trim() || ''
  if (!externalEhrId) {
    return { source: null, status: 'skipped', reason: 'patient_not_linked_to_ehr' }
  }

  if (externalEhrId.startsWith(NEXHEALTH_PATIENT_PREFIX)) {
    return {
      source: 'nexhealth',
      status: 'skipped',
      reason: 'nexhealth_insurance_not_supported',
    }
  }

  const source = externalEhrId.startsWith(OPEN_DENTAL_EXTERNAL_PREFIX) ? 'opendental' : 'ecw'

  try {
    if (source === 'opendental') {
      const result = await syncOpenDentalInsuranceForPatient({
        practiceId: params.practiceId,
        patientId: params.patientId,
        externalEhrId,
        actorUserId: params.actorUserId,
      })
      if (result.status === 'success') {
        return { source, status: 'success', syncedCount: result.syncedCount }
      }
      if (result.status === 'skipped') {
        return { source, status: 'skipped', reason: result.reason }
      }
      return { source, status: 'error', message: result.message }
    }

    const result = await syncPatientInsuranceFromEhr({
      practiceId: params.practiceId,
      patientId: params.patientId,
      actorUserId: params.actorUserId,
    })
    if (result.status === 'success') {
      return { source, status: 'success', syncedCount: result.syncedCount }
    }
    if (result.status === 'skipped') {
      return { source, status: 'skipped', reason: result.reason }
    }
    return { source, status: 'error', message: result.message }
  } catch (error) {
    return {
      source,
      status: 'error',
      message: error instanceof Error ? error.message : 'ehr_insurance_sync_failed',
    }
  }
}
