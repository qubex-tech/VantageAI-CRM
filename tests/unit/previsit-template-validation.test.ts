import { describe, expect, it } from 'vitest'
import { preVisitTemplateSchema } from '@/lib/validations'

describe('preVisitTemplateSchema', () => {
  it('accepts valid new patient and follow-up variants', () => {
    const parsed = preVisitTemplateSchema.parse({
      formatStyle: 'custom',
      variants: {
        new_patient: {
          label: 'New Patient',
          smartPhrases: ['.hpi'],
          sections: [{ id: 'chief_complaint', title: 'Chief Complaint', required: true }],
        },
        follow_up: {
          label: 'Follow-up',
          smartPhrases: [],
          sections: [{ id: 'interval_history', title: 'Interval History', required: true }],
        },
      },
    })

    expect(parsed.variants.new_patient.sections).toHaveLength(1)
    expect(parsed.variants.follow_up.sections).toHaveLength(1)
  })

  it('rejects empty section lists', () => {
    expect(() =>
      preVisitTemplateSchema.parse({
        variants: {
          new_patient: { label: 'New', smartPhrases: [], sections: [] },
          follow_up: { label: 'Follow', smartPhrases: [], sections: [] },
        },
      })
    ).toThrow()
  })
})
