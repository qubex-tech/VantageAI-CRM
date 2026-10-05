import { describe, expect, it, vi, afterEach } from 'vitest'
import { answerFromChart, answerGlassesQuestion, glassesAskPrompt } from '@/lib/glasses/ask'
import { projectGlassesCards } from '@/lib/glasses/cards'
import { demoChartInput, demoGlassesPayload } from '@/lib/glasses/demo-chart'
import {
  externalAskAllowed,
  glassesFeatureStatus,
  healthcareAddendumRequiredBody,
  isHealthcareAddendumSigned,
} from '@/lib/glasses/healthcare-gate'
import {
  GLASSES_ANSWER_MS,
  GLASSES_DIM_MS,
  GLASSES_SLEEP_MS,
  GlassesDisplaySession,
} from '../../mobile/src/lib/glassesSession'

describe('glasses healthcare gate', () => {
  it('blocks real charts until the addendum flag is exactly true', () => {
    expect(isHealthcareAddendumSigned({ GLASSES_HEALTHCARE_ADDENDUM: 'true' })).toBe(true)
    expect(isHealthcareAddendumSigned({ GLASSES_HEALTHCARE_ADDENDUM: '1' })).toBe(false)
    expect(isHealthcareAddendumSigned({})).toBe(false)
    expect(glassesFeatureStatus({}).phiAllowed).toBe(false)
    expect(healthcareAddendumRequiredBody().code).toBe('HEALTHCARE_ADDENDUM_REQUIRED')
  })

  it('refuses Muse without the addendum and allows the covered model on the fictional chart', () => {
    expect(externalAskAllowed({ model: 'muse', demo: true, addendumSigned: false })).toBe(false)
    expect(externalAskAllowed({ model: 'muse', demo: false, addendumSigned: true })).toBe(true)
    expect(externalAskAllowed({ model: 'openai', demo: true, addendumSigned: false })).toBe(true)
    expect(externalAskAllowed({ model: 'openai', demo: false, addendumSigned: false })).toBe(false)
    expect(externalAskAllowed({ model: 'local', demo: false, addendumSigned: false })).toBe(true)
  })
})

describe('glasses cards', () => {
  it('projects a three-line glance, alerts, and last visit', () => {
    const payload = demoGlassesPayload()
    expect(payload.mode).toBe('demo')
    expect(payload.patientLabel).toBe('Jamie Demo')
    expect(payload.cards.map((card) => card.id)).toEqual(['glance', 'alerts', 'lastVisit'])
    expect(payload.cards[0].lines[0]).toBe('JAMIE DEMO · 54')
    expect(payload.cards[0].lines[1]).toBe('2:15 PM · Tooth pain')
    expect(payload.cards[0].lines[2]).toBe('ALLERGY')
    expect(payload.cards[1].lines).toEqual([
      'Allergy: Penicillin — rash',
      'Med: Warfarin 5 mg daily',
      'Fall risk',
    ])
    expect(payload.cards[2].lines[0]).toContain('extraction site')
    expect(payload.snippets.some((snippet) => snippet.text.includes('Penicillin'))).toBe(true)
  })

  it('does not treat a negated allergy line as an alert', () => {
    const cards = projectGlassesCards({
      ...demoChartInput(),
      notes: [{ type: 'general', content: 'NKDA. No known allergies.' }],
      tags: [],
      now: new Date('2026-10-04T18:00:00.000Z'),
    })
    expect(cards[0].lines[2]).toBe('')
    expect(cards[1].lines[0]).toBe('No alerts on the chart')
  })

  it('keeps each line short enough for the 600 pixel display', () => {
    const cards = projectGlassesCards({
      patientName: 'Alexandria Montgomery-Demonstration',
      reason: 'Comprehensive new patient exam with imaging and a long counseling discussion',
      notes: [
        {
          type: 'general',
          content:
            'Patient reported intermittent cold sensitivity after the last filling and wanted to review home care, night guard wear, and whether the bite still feels high on the left.',
        },
      ],
      now: new Date('2026-10-04T18:00:00.000Z'),
    })
    for (const card of cards) {
      for (const line of card.lines) {
        expect(line.length).toBeLessThanOrEqual(42)
      }
    }
    expect(cards[2].lines.filter(Boolean).length).toBe(3)
  })
})

describe('glasses ask', () => {
  const snippets = demoGlassesPayload().snippets

  it('answers from the loaded chart lines', () => {
    expect(answerFromChart('any allergy?', snippets)).toContain('Penicillin')
    expect(answerFromChart('warfarin dose', snippets)).toContain('Warfarin')
    expect(answerFromChart('favorite color', snippets)).toBe('Nothing in the loaded chart matches that.')
  })

  it('does not call Muse for a real chart when the addendum is off', async () => {
    const complete = vi.fn(async () => 'should not run')
    const result = await answerGlassesQuestion({
      question: 'what is the allergy',
      snippets,
      demo: false,
      env: { GLASSES_ASK_MODEL: 'muse' },
      complete,
    })
    expect(complete).not.toHaveBeenCalled()
    expect(result.model).toBe('local')
    expect(result.modelBlocked).toBe('muse')
    expect(result.answer).toContain('Penicillin')
  })

  it('does not call Muse for the fictional chart either', async () => {
    const complete = vi.fn(async () => 'should not run')
    const result = await answerGlassesQuestion({
      question: 'allergy',
      snippets,
      demo: true,
      env: { GLASSES_ASK_MODEL: 'muse' },
      complete,
    })
    expect(complete).not.toHaveBeenCalled()
    expect(result.modelBlocked).toBe('muse')
  })

  it('can use the covered model for the fictional chart', async () => {
    const complete = vi.fn(async () => 'Penicillin rash')
    const result = await answerGlassesQuestion({
      question: 'allergy',
      snippets,
      demo: true,
      env: { GLASSES_ASK_MODEL: 'openai' },
      complete,
    })
    expect(complete).toHaveBeenCalledOnce()
    expect(complete.mock.calls[0][0].model).toBe('openai')
    expect(complete.mock.calls[0][0].prompt).toContain('Penicillin')
    expect(complete.mock.calls[0][0].prompt).not.toContain('Jamie Demo chart id')
    expect(result).toEqual({ answer: 'Penicillin rash', model: 'openai' })
    expect(glassesAskPrompt('allergy', snippets)).toContain('Question: allergy')
  })
})

describe('glasses display session', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const cards = demoGlassesPayload().cards

  it('replaces the whole frame, sleeps without ending, and clears on stop', () => {
    vi.useFakeTimers()
    const session = new GlassesDisplaySession()
    session.start(cards)
    expect(session.getSnapshot().frame?.cardId).toBe('glance')
    session.nav('right')
    expect(session.getSnapshot().frame?.cardId).toBe('alerts')
    session.nav('left')
    expect(session.getSnapshot().frame?.cardId).toBe('glance')

    vi.advanceTimersByTime(GLASSES_DIM_MS)
    expect(session.getSnapshot().dimmed).toBe(true)
    expect(session.getSnapshot().asleep).toBe(false)
    expect(session.getSnapshot().state).toBe('started')

    vi.advanceTimersByTime(GLASSES_SLEEP_MS - GLASSES_DIM_MS)
    expect(session.getSnapshot().asleep).toBe(true)
    expect(session.getSnapshot().frame?.cardId).toBe('glance')

    expect(session.select()).toBe('wake')
    expect(session.getSnapshot().asleep).toBe(false)

    session.stop()
    expect(session.getSnapshot().state).toBe('stopped')
    expect(session.getSnapshot().frame).toBeNull()
  })

  it('holds an answer, then returns to the previous card', () => {
    vi.useFakeTimers()
    const session = new GlassesDisplaySession()
    session.start(cards)
    session.nav('down')
    expect(session.select()).toBe('ask')
    session.showAnswer('Penicillin — rash')
    expect(session.getSnapshot().frame?.cardId).toBe('answer')
    vi.advanceTimersByTime(GLASSES_ANSWER_MS)
    expect(session.getSnapshot().frame?.cardId).toBe('alerts')
    session.stop()
  })

  it('keeps a single active session', () => {
    const first = new GlassesDisplaySession()
    const second = new GlassesDisplaySession()
    first.start(cards)
    second.start(cards)
    expect(first.getSnapshot().state).toBe('stopped')
    expect(first.getSnapshot().frame).toBeNull()
    expect(second.getSnapshot().state).toBe('started')
    second.stop()
  })
})
