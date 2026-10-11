import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runAction } from '@/automations/action-runner'
import { prisma } from '@/lib/db'
import { syncLatestInsuranceFromEhr } from '@/lib/ehr/syncLatestInsuranceFromEhr'

vi.mock('@/lib/db', () => ({
  prisma: {
    patient: { findFirst: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    insurancePolicy: { findFirst: vi.fn() },
    eligibilityCheck: { findFirst: vi.fn() },
    automationActionLog: { create: vi.fn() },
  },
}))

vi.mock('@/lib/ehr/syncLatestInsuranceFromEhr', () => ({
  syncLatestInsuranceFromEhr: vi.fn(),
}))

vi.mock('@/lib/patient-activity', () => ({
  logPatientActivity: vi.fn(),
}))

describe('run_eligibility EHR refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'automation-user' } as never)
    vi.mocked(prisma.automationActionLog.create).mockResolvedValue({} as never)
  })

  it('does not call the EHR when the appointment is still outside the days-before window', async () => {
    const result = await runAction({
      practiceId: 'practice-1',
      runId: 'run-1',
      actionType: 'run_eligibility',
      actionArgs: { daysBefore: 1 },
      eventData: {
        patient: { id: 'patient-1' },
        appointment: { daysUntilStart: 4 },
      },
    })

    expect(result.status).toBe('skipped')
    expect(syncLatestInsuranceFromEhr).not.toHaveBeenCalled()
    expect(prisma.patient.findFirst).not.toHaveBeenCalled()
  })

  it('pulls EHR coverage before reading the CRM policy', async () => {
    vi.mocked(prisma.patient.findFirst)
      .mockResolvedValueOnce({
        id: 'patient-1',
        selfPay: true,
        externalEhrId: 'opendental:4401',
      } as never)
      .mockResolvedValueOnce({ selfPay: false } as never)
    vi.mocked(syncLatestInsuranceFromEhr).mockResolvedValue({
      source: 'opendental',
      status: 'success',
      syncedCount: 1,
    })
    vi.mocked(prisma.insurancePolicy.findFirst).mockResolvedValue(null)

    const result = await runAction({
      practiceId: 'practice-1',
      runId: 'run-1',
      actionType: 'run_eligibility',
      actionArgs: { patientId: 'patient-1', daysBefore: 1 },
      eventData: { appointment: { daysUntilStart: 1 } },
    })

    expect(syncLatestInsuranceFromEhr).toHaveBeenCalledWith({
      practiceId: 'practice-1',
      patientId: 'patient-1',
      externalEhrId: 'opendental:4401',
      actorUserId: 'automation-user',
    })
    expect(prisma.insurancePolicy.findFirst).toHaveBeenCalled()
    expect(result.status).toBe('skipped')
    expect(result.result.reason).toBe('No insurance policy on file')
    expect(result.result.ehrSync).toMatchObject({ source: 'opendental', syncedCount: 1 })
  })

  it('skips eligibility when the EHR has no coverage', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'patient-1',
      selfPay: false,
      externalEhrId: 'opendental:4401',
    } as never)
    vi.mocked(syncLatestInsuranceFromEhr).mockResolvedValue({
      source: 'opendental',
      status: 'success',
      syncedCount: 0,
    })

    const result = await runAction({
      practiceId: 'practice-1',
      runId: 'run-1',
      actionType: 'run_eligibility',
      actionArgs: { patientId: 'patient-1' },
      eventData: {},
    })

    expect(result.status).toBe('skipped')
    expect(result.result.reason).toBe('No insurance coverage in the EHR')
    expect(prisma.insurancePolicy.findFirst).not.toHaveBeenCalled()
  })

  it('uses the local policy when the EHR pull fails', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'patient-1',
      selfPay: false,
      externalEhrId: 'opendental:4401',
    } as never)
    vi.mocked(syncLatestInsuranceFromEhr).mockResolvedValue({
      source: 'opendental',
      status: 'error',
      message: 'od down',
    })
    vi.mocked(prisma.insurancePolicy.findFirst).mockResolvedValue(null)

    const result = await runAction({
      practiceId: 'practice-1',
      runId: 'run-1',
      actionType: 'run_eligibility',
      actionArgs: { patientId: 'patient-1' },
      eventData: {},
    })

    expect(prisma.insurancePolicy.findFirst).toHaveBeenCalled()
    expect(result.status).toBe('skipped')
    expect(result.result.reason).toBe('No insurance policy on file')
    expect(result.result.ehrSync).toMatchObject({ status: 'error', message: 'od down' })
  })
})
