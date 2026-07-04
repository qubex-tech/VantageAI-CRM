import { describe, it, expect } from 'vitest'
import { collectExplicitEcwPractitionerRefs } from '@/lib/integrations/ehr/scheduleSync'

describe('collectExplicitEcwPractitionerRefs', () => {
  it('merges schedule, scheduling, and telephone refs without duplicates', () => {
    expect(
      collectExplicitEcwPractitionerRefs(
        {
          ecwSchedulePractitionerRefs: 'Practitioner/a, Practitioner/b',
          ecwTelephonePractitionerRef: 'Practitioner/a',
        },
        {
          readSource: 'ecw',
          writeSource: 'none',
          defaultReadPractitionerRefs: ['Practitioner/c'],
        }
      )
    ).toEqual(['Practitioner/a', 'Practitioner/b', 'Practitioner/c'])
  })
})
