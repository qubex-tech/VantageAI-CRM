import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runAction } from '@/automations/action-runner'
import { prisma } from '@/lib/db'

const sendCurogramAiCallsToAction = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    patient: {
      findFirst: vi.fn(),
    },
    automationActionLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/curogram', () => ({
  normalizePhoneToE164: (phone: string) => phone,
  normalizeCurogramAiV2Gender: () => undefined,
  sendCurogramAiCallsToAction: (...args: unknown[]) => sendCurogramAiCallsToAction(...args),
}))

vi.mock('@/lib/patient-activity', () => ({
  logPatientActivity: vi.fn().mockResolvedValue(undefined),
}))

describe('trigger_curogram_template action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls Curogram with actionId when patient identity is complete', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue({
      id: 'patient-1',
      name: 'Jane Doe',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+15551234567',
      primaryPhone: '+15551234567',
      dateOfBirth: new Date('1990-01-15'),
      gender: 'female',
      deletedAt: null,
    })
    ;(prisma.automationActionLog.create as any).mockResolvedValue({})
    sendCurogramAiCallsToAction.mockResolvedValue({ ok: true, status: 200, body: 'ok' })

    const result = await runAction({
      practiceId: 'practice-1',
      runId: 'run-1',
      actionType: 'trigger_curogram_template',
      actionArgs: {
        patientId: 'patient-1',
        actionId: 'curo-action-123',
      },
      eventData: {},
    })

    expect(result.status).toBe('succeeded')
    expect(sendCurogramAiCallsToAction).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Jane',
        lastName: 'Doe',
        phoneNumber: '+15551234567',
        actionId: 'curo-action-123',
      })
    )
  })

  it('skips when patient is missing DOB', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue({
      id: 'patient-1',
      name: 'Jane Doe',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+15551234567',
      primaryPhone: '+15551234567',
      dateOfBirth: null,
      gender: null,
      deletedAt: null,
    })
    ;(prisma.automationActionLog.create as any).mockResolvedValue({})

    const result = await runAction({
      practiceId: 'practice-1',
      runId: 'run-1',
      actionType: 'trigger_curogram_template',
      actionArgs: {
        patientId: 'patient-1',
        actionId: 'curo-action-123',
      },
      eventData: {},
    })

    expect(result.status).toBe('skipped')
    expect(sendCurogramAiCallsToAction).not.toHaveBeenCalled()
  })

  it('rejects missing actionId', async () => {
    ;(prisma.automationActionLog.create as any).mockResolvedValue({})

    const result = await runAction({
      practiceId: 'practice-1',
      runId: 'run-1',
      actionType: 'trigger_curogram_template',
      actionArgs: {
        patientId: 'patient-1',
      },
      eventData: {},
    })

    expect(result.status).toBe('failed')
    expect(result.error).toContain('Validation error')
  })
})
