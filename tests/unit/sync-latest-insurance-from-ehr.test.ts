import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncLatestInsuranceFromEhr } from '@/lib/ehr/syncLatestInsuranceFromEhr'
import { syncPatientInsuranceFromEhr } from '@/lib/ehr/syncPatientInsuranceFromEhr'
import { syncOpenDentalInsuranceForPatient } from '@/lib/integrations/opendental/insuranceSync'

vi.mock('@/lib/integrations/opendental/patientSync', () => ({
  OPEN_DENTAL_EXTERNAL_PREFIX: 'opendental:',
}))

vi.mock('@/lib/integrations/opendental/insuranceSync', () => ({
  syncOpenDentalInsuranceForPatient: vi.fn(),
}))

vi.mock('@/lib/ehr/syncPatientInsuranceFromEhr', () => ({
  syncPatientInsuranceFromEhr: vi.fn(),
}))

describe('syncLatestInsuranceFromEhr', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pulls Open Dental family insurance for an opendental patient', async () => {
    vi.mocked(syncOpenDentalInsuranceForPatient).mockResolvedValue({
      status: 'success',
      syncedCount: 2,
      policies: [],
      insuranceStatus: 'verified',
      coveragesFromEhr: [],
    })

    const result = await syncLatestInsuranceFromEhr({
      practiceId: 'practice-1',
      patientId: 'patient-1',
      externalEhrId: 'opendental:4401',
      actorUserId: 'user-1',
    })

    expect(syncOpenDentalInsuranceForPatient).toHaveBeenCalledWith({
      practiceId: 'practice-1',
      patientId: 'patient-1',
      externalEhrId: 'opendental:4401',
      actorUserId: 'user-1',
    })
    expect(syncPatientInsuranceFromEhr).not.toHaveBeenCalled()
    expect(result).toEqual({ source: 'opendental', status: 'success', syncedCount: 2 })
  })

  it('pulls eCW coverage for a non-Open Dental chart', async () => {
    vi.mocked(syncPatientInsuranceFromEhr).mockResolvedValue({
      status: 'success',
      syncedCount: 1,
      policies: [],
      insuranceStatus: 'verified',
      coveragesFromEhr: [],
    })

    const result = await syncLatestInsuranceFromEhr({
      practiceId: 'practice-1',
      patientId: 'patient-1',
      externalEhrId: 'Patient/99',
    })

    expect(syncPatientInsuranceFromEhr).toHaveBeenCalledWith({
      practiceId: 'practice-1',
      patientId: 'patient-1',
      actorUserId: undefined,
    })
    expect(syncOpenDentalInsuranceForPatient).not.toHaveBeenCalled()
    expect(result).toEqual({ source: 'ecw', status: 'success', syncedCount: 1 })
  })

  it('skips the EHR call when the patient is not linked', async () => {
    const result = await syncLatestInsuranceFromEhr({
      practiceId: 'practice-1',
      patientId: 'patient-1',
      externalEhrId: '  ',
    })

    expect(result).toEqual({
      source: null,
      status: 'skipped',
      reason: 'patient_not_linked_to_ehr',
    })
    expect(syncOpenDentalInsuranceForPatient).not.toHaveBeenCalled()
    expect(syncPatientInsuranceFromEhr).not.toHaveBeenCalled()
  })

  it('returns an error summary when the EHR pull throws', async () => {
    vi.mocked(syncOpenDentalInsuranceForPatient).mockRejectedValue(new Error('od down'))

    const result = await syncLatestInsuranceFromEhr({
      practiceId: 'practice-1',
      patientId: 'patient-1',
      externalEhrId: 'opendental:12',
    })

    expect(result).toEqual({ source: 'opendental', status: 'error', message: 'od down' })
  })
})
