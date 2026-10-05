import { projectGlassesCards, snippetsForAsk } from '@/lib/glasses/cards'
import { isHealthcareAddendumSigned } from '@/lib/glasses/healthcare-gate'
import type { GlassesCard, GlassesChartInput, GlassesSnippet } from '@/lib/glasses/types'

/** Fictional chart. Never loaded from the database. */
export function demoChartInput(): GlassesChartInput {
  return {
    patientName: 'Jamie Demo',
    dateOfBirth: '1972-04-03',
    visitType: 'Follow-up',
    reason: 'Tooth pain',
    appointmentStart: '2026-10-04T19:15:00.000Z',
    timeZone: 'America/Chicago',
    notes: [
      { type: 'allergy', content: 'Penicillin — rash' },
      { type: 'medication', content: 'Warfarin 5 mg daily' },
      {
        type: 'general',
        content:
          'Last visit: extraction site healing. Mild sensitivity to cold. No swelling.',
      },
    ],
    tags: ['Fall risk'],
  }
}

export function demoGlassesPayload(now = new Date('2026-10-04T18:00:00.000Z')): {
  mode: 'demo'
  phiAllowed: boolean
  patientLabel: string
  cards: GlassesCard[]
  snippets: GlassesSnippet[]
  notice: string
} {
  const input = { ...demoChartInput(), now }
  const cards = projectGlassesCards(input)
  return {
    mode: 'demo',
    phiAllowed: isHealthcareAddendumSigned(),
    patientLabel: 'Jamie Demo',
    cards,
    snippets: snippetsForAsk(input, cards),
    notice:
      'Fictional chart. A real patient stays off the glasses until Meta’s healthcare addendum is signed.',
  }
}
