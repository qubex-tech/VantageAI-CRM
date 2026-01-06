import { describe, it, expect } from 'vitest'
import { evaluateConditions } from '@/automations/condition-evaluator'

describe('Condition Evaluator', () => {
  describe('Field conditions', () => {
    it('should evaluate equals condition correctly', () => {
      const condition = {
        field: 'status',
        operator: 'equals' as const,
        value: 'scheduled',
      }

      expect(evaluateConditions(condition, { status: 'scheduled' })).toBe(true)
      expect(evaluateConditions(condition, { status: 'completed' })).toBe(false)
    })

    it('should evaluate not_equals condition correctly', () => {
      const condition = {
        field: 'status',
        operator: 'not_equals' as const,
        value: 'cancelled',
      }

      expect(evaluateConditions(condition, { status: 'scheduled' })).toBe(true)
      expect(evaluateConditions(condition, { status: 'cancelled' })).toBe(false)
    })

    it('should evaluate contains condition correctly', () => {
      const condition = {
        field: 'name',
        operator: 'contains' as const,
        value: 'John',
      }

      expect(evaluateConditions(condition, { name: 'John Doe' })).toBe(true)
      expect(evaluateConditions(condition, { name: 'Jane Doe' })).toBe(false)
    })

    it('should evaluate exists condition correctly', () => {
      const condition = {
        field: 'email',
        operator: 'exists' as const,
      }

      expect(evaluateConditions(condition, { email: 'test@example.com' })).toBe(true)
      expect(evaluateConditions(condition, { name: 'John' })).toBe(false)
    })

    it('should evaluate nested field paths', () => {
      const condition = {
        field: 'appointment.status',
        operator: 'equals' as const,
        value: 'scheduled',
      }

      expect(
        evaluateConditions(condition, {
          appointment: { status: 'scheduled' },
        })
      ).toBe(true)
    })
  })

  describe('Condition groups', () => {
    it('should evaluate AND conditions correctly', () => {
      const condition = {
        operator: 'and' as const,
        conditions: [
          { field: 'status', operator: 'equals' as const, value: 'scheduled' },
          { field: 'patientId', operator: 'exists' as const },
        ],
      }

      expect(
        evaluateConditions(condition, {
          status: 'scheduled',
          patientId: '123',
        })
      ).toBe(true)

      expect(
        evaluateConditions(condition, {
          status: 'completed',
          patientId: '123',
        })
      ).toBe(false)
    })

    it('should evaluate OR conditions correctly', () => {
      const condition = {
        operator: 'or' as const,
        conditions: [
          { field: 'status', operator: 'equals' as const, value: 'scheduled' },
          { field: 'status', operator: 'equals' as const, value: 'confirmed' },
        ],
      }

      expect(evaluateConditions(condition, { status: 'scheduled' })).toBe(true)
      expect(evaluateConditions(condition, { status: 'confirmed' })).toBe(true)
      expect(evaluateConditions(condition, { status: 'completed' })).toBe(false)
    })

    it('should handle nested condition groups', () => {
      const condition = {
        operator: 'and' as const,
        conditions: [
          { field: 'status', operator: 'equals' as const, value: 'scheduled' },
          {
            operator: 'or' as const,
            conditions: [
              { field: 'visitType', operator: 'equals' as const, value: 'Consultation' },
              { field: 'visitType', operator: 'equals' as const, value: 'Follow-up' },
            ],
          },
        ],
      }

      expect(
        evaluateConditions(condition, {
          status: 'scheduled',
          visitType: 'Consultation',
        })
      ).toBe(true)

      expect(
        evaluateConditions(condition, {
          status: 'scheduled',
          visitType: 'Other',
        })
      ).toBe(false)
    })
  })

  describe('Error handling', () => {
    it('should return false for invalid conditions', () => {
      const invalidCondition = {
        field: 'nonexistent',
        operator: 'invalid' as any,
        value: 'test',
      }

      expect(evaluateConditions(invalidCondition, {})).toBe(false)
    })

    it('should handle missing fields gracefully', () => {
      const condition = {
        field: 'nonexistent',
        operator: 'equals' as const,
        value: 'test',
      }

      expect(evaluateConditions(condition, {})).toBe(false)
    })
  })
})

