import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runAction } from '@/automations/action-runner'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    patient: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    patientNote: {
      create: vi.fn(),
    },
    automationActionLog: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

describe('Action Runner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Schema validation', () => {
    it('should validate create_note action schema', async () => {
      const mockPatient = {
        id: 'patient-1',
        practiceId: 'practice-1',
        deletedAt: null,
      }

      const mockUser = {
        id: 'user-1',
        practiceId: 'practice-1',
      }

      ;(prisma.patient.findFirst as any).mockResolvedValue(mockPatient)
      ;(prisma.user.findUnique as any).mockResolvedValue(mockUser)
      ;(prisma.patientNote.create as any).mockResolvedValue({ id: 'note-1' })
      ;(prisma.automationActionLog.create as any).mockResolvedValue({})

      const result = await runAction({
        practiceId: 'practice-1',
        runId: 'run-1',
        actionType: 'create_note',
        actionArgs: {
          patientId: 'patient-1',
          type: 'general',
          content: 'Test note',
        },
        eventData: { userId: 'user-1' },
      })

      expect(result.status).toBe('succeeded')
      expect(prisma.patientNote.create).toHaveBeenCalled()
    })

    it('should reject invalid create_note action args', async () => {
      ;(prisma.automationActionLog.create as any).mockResolvedValue({})

      const result = await runAction({
        practiceId: 'practice-1',
        runId: 'run-1',
        actionType: 'create_note',
        actionArgs: {
          // Missing required fields
          patientId: 'patient-1',
        },
        eventData: {},
      })

      expect(result.status).toBe('failed')
      expect(result.error).toContain('Validation error')
    })
  })

  describe('Tenant scoping', () => {
    it('should enforce practiceId scope when finding patients', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue(null) // Patient not found (wrong practice)
      ;(prisma.automationActionLog.create as any).mockResolvedValue({})

      const result = await runAction({
        practiceId: 'practice-1',
        runId: 'run-1',
        actionType: 'create_note',
        actionArgs: {
          patientId: 'patient-1',
          type: 'general',
          content: 'Test note',
        },
        eventData: {},
      })

      expect(result.status).toBe('failed')
      expect(result.error).toContain('not found')
      expect(prisma.patient.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'patient-1',
          practiceId: 'practice-1',
          deletedAt: null,
        },
      })
    })
  })

  describe('Action logging', () => {
    it('should log all actions to AutomationActionLog', async () => {
      const mockPatient = {
        id: 'patient-1',
        practiceId: 'practice-1',
        deletedAt: null,
        phone: '+1234567890',
      }

      ;(prisma.patient.findFirst as any).mockResolvedValue(mockPatient)
      ;(prisma.automationActionLog.create as any).mockResolvedValue({})

      await runAction({
        practiceId: 'practice-1',
        runId: 'run-1',
        actionType: 'draft_sms',
        actionArgs: {
          patientId: 'patient-1',
          message: 'Test message',
        },
        eventData: {},
      })

      expect(prisma.automationActionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          runId: 'run-1',
          practiceId: 'practice-1',
          actionType: 'draft_sms',
          status: expect.any(String),
        }),
      })
    })
  })

  describe('Unknown action types', () => {
    it('should fail for unknown action types', async () => {
      ;(prisma.automationActionLog.create as any).mockResolvedValue({})

      const result = await runAction({
        practiceId: 'practice-1',
        runId: 'run-1',
        actionType: 'unknown_action',
        actionArgs: {},
        eventData: {},
      })

      expect(result.status).toBe('failed')
      expect(result.error).toContain('Unknown action type')
    })
  })
})

