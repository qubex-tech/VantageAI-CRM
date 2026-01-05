import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateToolName, ALLOWED_TOOLS } from './healix-tools'

describe('Healix Tools', () => {
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
})

