import { describe, it, expect } from 'vitest'
import { defaultFormTemplates } from '@/lib/form-templates'

describe('Form Templates', () => {
  describe('defaultFormTemplates', () => {
    it('should have at least one default template', () => {
      expect(defaultFormTemplates.length).toBeGreaterThan(0)
    })

    it('should have valid categories for all templates', () => {
      const validCategories = ['intake', 'consent', 'medical_history', 'custom']
      defaultFormTemplates.forEach(template => {
        expect(validCategories).toContain(template.category)
      })
    })

    it('should have unique names for all templates', () => {
      const names = defaultFormTemplates.map(t => t.name)
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(names.length)
    })

    it('should have schema with fields for all templates', () => {
      defaultFormTemplates.forEach(template => {
        expect(template.schema).toBeDefined()
        expect(template.schema.fields).toBeDefined()
        expect(Array.isArray(template.schema.fields)).toBe(true)
        expect(template.schema.fields.length).toBeGreaterThan(0)
      })
    })

    it('should have schema version for all templates', () => {
      defaultFormTemplates.forEach(template => {
        expect(template.schema.version).toBeDefined()
        expect(typeof template.schema.version).toBe('number')
      })
    })

    it('should have valid field types for all fields', () => {
      const validFieldTypes = ['text', 'textarea', 'number', 'date', 'select', 'checkbox']
      defaultFormTemplates.forEach(template => {
        template.schema.fields.forEach(field => {
          expect(validFieldTypes).toContain(field.type)
        })
      })
    })

    it('should have id and label for all fields', () => {
      defaultFormTemplates.forEach(template => {
        template.schema.fields.forEach(field => {
          expect(field.id).toBeDefined()
          expect(typeof field.id).toBe('string')
          expect(field.id.length).toBeGreaterThan(0)
          
          expect(field.label).toBeDefined()
          expect(typeof field.label).toBe('string')
          expect(field.label.length).toBeGreaterThan(0)
        })
      })
    })

    it('should have Patient Intake template', () => {
      const intakeTemplate = defaultFormTemplates.find(t => t.name === 'Patient Intake')
      expect(intakeTemplate).toBeDefined()
      expect(intakeTemplate?.category).toBe('intake')
    })

    it('should have Medical History template', () => {
      const medHistTemplate = defaultFormTemplates.find(t => t.name === 'Medical History')
      expect(medHistTemplate).toBeDefined()
      expect(medHistTemplate?.category).toBe('medical_history')
    })

    it('should have Consent to Treat template', () => {
      const consentTemplate = defaultFormTemplates.find(t => t.name === 'Consent to Treat')
      expect(consentTemplate).toBeDefined()
      expect(consentTemplate?.category).toBe('consent')
    })

    it('should have select fields with options', () => {
      defaultFormTemplates.forEach(template => {
        template.schema.fields.forEach(field => {
          if (field.type === 'select') {
            expect(field.options).toBeDefined()
            expect(Array.isArray(field.options)).toBe(true)
            expect(field.options!.length).toBeGreaterThan(0)
          }
        })
      })
    })
  })
})
