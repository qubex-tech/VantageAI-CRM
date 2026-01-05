import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateToolName, ALLOWED_TOOLS, executeTool } from '@/lib/healix-tools'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
    },
  },
}))

describe('Healix Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateToolName', () => {
    it('should return true for allowed tool names', () => {
      for (const tool of ALLOWED_TOOLS) {
        expect(validateToolName(tool)).toBe(true)
      }
    })

    it('should return false for disallowed tool names', () => {
      expect(validateToolName('invalidTool')).toBe(false)
      expect(validateToolName('deletePatient')).toBe(false)
      expect(validateToolName('updateMedicalRecords')).toBe(false)
      expect(validateToolName('')).toBe(false)
    })

    it('should be case-sensitive', () => {
      expect(validateToolName('createtask')).toBe(false)
      expect(validateToolName('CREATETASK')).toBe(false)
      expect(validateToolName('createTask')).toBe(true)
    })
  })

  describe('executeTool - permission checks', () => {
    it('should reject tool calls without clinicId', async () => {
      const result = await executeTool('createTask', {}, 'user-id')
      expect(result.success).toBe(false)
      expect(result.message).toContain('clinicId is required')
    })

    it('should reject invalid tool names', async () => {
      const result = await executeTool('invalidTool', { clinicId: 'clinic-id' }, 'user-id')
      expect(result.success).toBe(false)
      expect(result.message).toContain('not allowed')
    })

    it('should check user permissions', async () => {
      // Mock user not found
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const result = await executeTool(
        'createTask',
        {
          clinicId: 'clinic-id',
          title: 'Test Task',
          patientId: 'patient-id',
        },
        'user-id'
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('Access denied')
    })
  })
})

