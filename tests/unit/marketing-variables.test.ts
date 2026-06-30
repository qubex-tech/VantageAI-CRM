import { describe, it, expect } from 'vitest'
import {
  extractVariables,
  resolveVariable,
  replaceVariables,
  validateVariables,
} from '@/lib/marketing/variables'
import type { VariableContext } from '@/lib/marketing/types'

describe('Marketing Variable Utilities', () => {
  describe('extractVariables', () => {
    it('should extract simple variables from string', () => {
      const result = extractVariables('Hello {{patient.firstName}}!')
      expect(result).toContain('patient.firstName')
    })

    it('should extract multiple variables', () => {
      const template = 'Hello {{patient.firstName}} {{patient.lastName}}!'
      const result = extractVariables(template)
      
      expect(result).toContain('patient.firstName')
      expect(result).toContain('patient.lastName')
    })

    it('should not duplicate variables', () => {
      const template = '{{patient.firstName}} and {{patient.firstName}} again'
      const result = extractVariables(template)
      
      expect(result.length).toBe(1)
      expect(result[0]).toBe('patient.firstName')
    })

    it('should extract variables from complex HTML', () => {
      const html = `
        <div>
          <h1>Hello {{patient.preferredName}}</h1>
          <p>Your appointment at {{practice.name}} is on {{appointment.date}}.</p>
          <a href="{{links.confirm}}">Confirm</a>
        </div>
      `
      const result = extractVariables(html)
      
      expect(result).toContain('patient.preferredName')
      expect(result).toContain('practice.name')
      expect(result).toContain('appointment.date')
      expect(result).toContain('links.confirm')
    })

    it('should extract variables from JSON object', () => {
      const obj = {
        greeting: 'Hello {{patient.firstName}}',
        body: {
          text: 'Visit us at {{practice.address}}',
        },
      }
      const result = extractVariables(obj)
      
      expect(result).toContain('patient.firstName')
      expect(result).toContain('practice.address')
    })

    it('should handle variables with whitespace', () => {
      const template = 'Hello {{ patient.firstName }} and {{  patient.lastName  }}'
      const result = extractVariables(template)
      
      expect(result).toContain('patient.firstName')
      expect(result).toContain('patient.lastName')
    })

    it('should return empty array for no variables', () => {
      const result = extractVariables('Hello world!')
      expect(result).toEqual([])
    })

    it('should handle empty string', () => {
      expect(extractVariables('')).toEqual([])
    })

    it('should handle nested object structures', () => {
      const obj = {
        rows: [
          {
            columns: [
              {
                blocks: [
                  { content: '{{patient.firstName}}' },
                  { content: '{{appointment.time}}' },
                ],
              },
            ],
          },
        ],
      }
      const result = extractVariables(obj)
      
      expect(result).toContain('patient.firstName')
      expect(result).toContain('appointment.time')
    })
  })

  describe('resolveVariable', () => {
    const context: VariableContext = {
      patient: {
        firstName: 'John',
        lastName: 'Doe',
        preferredName: 'Johnny',
      },
      practice: {
        name: 'Test Practice',
        phone: '555-1234',
        address: '123 Main St',
      },
      appointment: {
        date: 'June 15, 2024',
        time: '10:00 AM',
        location: 'Main Office',
        providerName: 'Dr. Smith',
      },
      links: {
        confirm: 'https://example.com/confirm',
        reschedule: 'https://example.com/reschedule',
        cancel: 'https://example.com/cancel',
      },
    }

    it('should resolve simple patient variables', () => {
      expect(resolveVariable('patient.firstName', context)).toBe('John')
      expect(resolveVariable('patient.lastName', context)).toBe('Doe')
      expect(resolveVariable('patient.preferredName', context)).toBe('Johnny')
    })

    it('should resolve practice variables', () => {
      expect(resolveVariable('practice.name', context)).toBe('Test Practice')
      expect(resolveVariable('practice.phone', context)).toBe('555-1234')
      expect(resolveVariable('practice.address', context)).toBe('123 Main St')
    })

    it('should resolve appointment variables', () => {
      expect(resolveVariable('appointment.date', context)).toBe('June 15, 2024')
      expect(resolveVariable('appointment.time', context)).toBe('10:00 AM')
      expect(resolveVariable('appointment.providerName', context)).toBe('Dr. Smith')
    })

    it('should resolve link variables', () => {
      expect(resolveVariable('links.confirm', context)).toBe('https://example.com/confirm')
      expect(resolveVariable('links.reschedule', context)).toBe('https://example.com/reschedule')
    })

    it('should return fallback for missing patient.firstName', () => {
      const emptyContext: VariableContext = {}
      expect(resolveVariable('patient.firstName', emptyContext)).toBe('there')
    })

    it('should return fallback for missing practice.name', () => {
      const emptyContext: VariableContext = {}
      expect(resolveVariable('practice.name', emptyContext)).toBe('our practice')
    })

    it('should return "#" for missing links', () => {
      const emptyContext: VariableContext = {}
      expect(resolveVariable('links.confirm', emptyContext)).toBe('#')
      expect(resolveVariable('links.unknown', emptyContext)).toBe('#')
    })

    it('should return empty string for unknown patient fields', () => {
      const emptyContext: VariableContext = {}
      expect(resolveVariable('patient.unknownField', emptyContext)).toBe('')
    })

    it('should return empty string for completely unknown variables', () => {
      const emptyContext: VariableContext = {}
      expect(resolveVariable('unknown.variable', emptyContext)).toBe('')
    })

    it('should convert non-string values to string', () => {
      const contextWithNumber: VariableContext = {
        patient: {
          age: 30 as any,
        },
      }
      expect(resolveVariable('patient.age', contextWithNumber)).toBe('30')
    })

    it('should handle null values with fallback', () => {
      const contextWithNull: VariableContext = {
        patient: {
          firstName: null as any,
        },
      }
      expect(resolveVariable('patient.firstName', contextWithNull)).toBe('there')
    })
  })

  describe('replaceVariables', () => {
    const context: VariableContext = {
      patient: {
        firstName: 'John',
        lastName: 'Doe',
      },
      practice: {
        name: 'Dental Care',
      },
      appointment: {
        date: 'June 15',
        time: '10:00 AM',
      },
    }

    it('should replace single variable', () => {
      const result = replaceVariables('Hello {{patient.firstName}}!', context)
      expect(result).toBe('Hello John!')
    })

    it('should replace multiple variables', () => {
      const template = 'Hello {{patient.firstName}} {{patient.lastName}}'
      const result = replaceVariables(template, context)
      expect(result).toBe('Hello John Doe')
    })

    it('should replace variables in complex template', () => {
      const template = `
Dear {{patient.firstName}},

Your appointment at {{practice.name}} is scheduled for {{appointment.date}} at {{appointment.time}}.

Best regards,
{{practice.name}}
      `.trim()

      const result = replaceVariables(template, context)
      
      expect(result).toContain('Dear John,')
      expect(result).toContain('Dental Care')
      expect(result).toContain('June 15')
      expect(result).toContain('10:00 AM')
    })

    it('should handle missing variables with fallbacks', () => {
      const template = 'Hello {{patient.firstName}}, call {{practice.phone}}'
      const partialContext: VariableContext = {
        patient: { firstName: 'Jane' },
      }
      
      const result = replaceVariables(template, partialContext)
      expect(result).toBe('Hello Jane, call ')
    })

    it('should handle variables with whitespace', () => {
      const result = replaceVariables('Hello {{ patient.firstName }}!', context)
      expect(result).toBe('Hello John!')
    })

    it('should not modify text without variables', () => {
      const template = 'Hello World!'
      expect(replaceVariables(template, context)).toBe('Hello World!')
    })

    it('should handle empty template', () => {
      expect(replaceVariables('', context)).toBe('')
    })

    it('should handle empty context with fallbacks', () => {
      const template = 'Hello {{patient.firstName}}!'
      const result = replaceVariables(template, {})
      expect(result).toBe('Hello there!')
    })
  })

  describe('validateVariables', () => {
    it('should validate known variable prefixes', () => {
      const content = '{{patient.firstName}} at {{practice.name}}'
      const result = validateVariables(content)
      
      expect(result.valid).toBe(true)
      expect(result.known).toContain('patient.firstName')
      expect(result.known).toContain('practice.name')
      expect(result.unknown).toEqual([])
    })

    it('should identify unknown variables', () => {
      const content = '{{patient.firstName}} and {{custom.field}}'
      const result = validateVariables(content)
      
      expect(result.valid).toBe(false)
      expect(result.known).toContain('patient.firstName')
      expect(result.unknown).toContain('custom.field')
    })

    it('should recognize all standard prefixes', () => {
      const content = `
        {{patient.firstName}}
        {{practice.name}}
        {{appointment.date}}
        {{links.confirm}}
      `
      const result = validateVariables(content)
      
      expect(result.valid).toBe(true)
      expect(result.known.length).toBe(4)
    })

    it('should handle content without variables', () => {
      const result = validateVariables('Hello World!')
      
      expect(result.valid).toBe(true)
      expect(result.known).toEqual([])
      expect(result.unknown).toEqual([])
    })

    it('should validate JSON object', () => {
      const obj = {
        greeting: '{{patient.firstName}}',
        location: '{{custom.location}}',
      }
      const result = validateVariables(obj)
      
      expect(result.valid).toBe(false)
      expect(result.known).toContain('patient.firstName')
      expect(result.unknown).toContain('custom.location')
    })

    it('should handle empty string', () => {
      const result = validateVariables('')
      expect(result.valid).toBe(true)
      expect(result.known).toEqual([])
      expect(result.unknown).toEqual([])
    })

    it('should correctly categorize all appointment variables', () => {
      const content = '{{appointment.date}} {{appointment.time}} {{appointment.location}} {{appointment.providerName}}'
      const result = validateVariables(content)
      
      expect(result.valid).toBe(true)
      expect(result.known.length).toBe(4)
    })

    it('should correctly categorize all links variables', () => {
      const content = '{{links.confirm}} {{links.reschedule}} {{links.cancel}} {{links.portalVerified}}'
      const result = validateVariables(content)
      
      expect(result.valid).toBe(true)
      expect(result.known.length).toBe(4)
    })
  })
})
