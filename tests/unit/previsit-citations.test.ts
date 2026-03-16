import { describe, expect, it } from 'vitest'
import { validateAndNumberCitations } from '@/lib/previsit/citations'

const evidenceItems = [
  {
    sourceId: 'note:1',
    sourceType: 'patient_note' as const,
    title: 'Note',
    snippet: 'Patient reports better sleep.',
  },
  {
    sourceId: 'appointment:1',
    sourceType: 'appointment' as const,
    title: 'Visit',
    snippet: 'Follow-up completed.',
  },
]

describe('validateAndNumberCitations', () => {
  it('numbers valid source references', () => {
    const result = validateAndNumberCitations({
      sections: [
        {
          id: 'assessment',
          title: 'Assessment',
          content: 'Improved sleep quality.',
          sourceIds: ['note:1'],
        },
        {
          id: 'plan',
          title: 'Plan',
          content: 'Schedule follow-up visit.',
          sourceIds: ['appointment:1', 'note:1'],
        },
      ],
      evidenceItems,
    })

    expect(result.sections[0].references[0].number).toBe(1)
    expect(result.sections[1].references[0].number).toBe(2)
    expect(result.references).toHaveLength(2)
  })

  it('rejects unknown citation source IDs', () => {
    expect(() =>
      validateAndNumberCitations({
        sections: [
          {
            id: 'assessment',
            title: 'Assessment',
            content: 'Unverified claim.',
            sourceIds: ['missing:1'],
          },
        ],
        evidenceItems,
      })
    ).toThrow('Invalid citation source IDs')
  })

  it('rejects uncited content unless explicitly no evidence', () => {
    expect(() =>
      validateAndNumberCitations({
        sections: [
          {
            id: 'assessment',
            title: 'Assessment',
            content: 'This has no citation.',
            sourceIds: [],
          },
        ],
        evidenceItems,
      })
    ).toThrow('contains content without evidence citations')

    expect(() =>
      validateAndNumberCitations({
        sections: [
          {
            id: 'assessment',
            title: 'Assessment',
            content: 'No supporting evidence found for this claim.',
            sourceIds: [],
          },
        ],
        evidenceItems,
      })
    ).not.toThrow()
  })
})
