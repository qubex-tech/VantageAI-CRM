import { describe, expect, it } from 'vitest'
import { classifyVisitTypeGroup, groupVisitTypes } from '@/automations/visit-type-groups'
import { evaluateConditions } from '@/automations/condition-evaluator'

const LONESTAR_TYPES = [
  'Televisit Followup',
  'Televisit 2nd FU',
  'Televisit New Patient',
  'Self pay-TVFU',
  'Self-Pay Televisit 2nd FU',
  'Self-pay TVNP',
  'Follow Up Visit',
  'New Patient',
  '2nd Follow up',
  'Self pay-NP',
  'Self pay-F/U',
  '2nd follow up Self pay',
  'Ultrasound',
  'Infusions',
  'Certified Medical Assistant Visit',
  'EHR Appointment',
]

describe('visit type groups', () => {
  it('puts televisit names under TV and office visits under OV', () => {
    const grouped = groupVisitTypes(LONESTAR_TYPES)
    expect(grouped.groups.find((group) => group.id === 'TV')?.types).toEqual([
      'Televisit Followup',
      'Televisit 2nd FU',
      'Televisit New Patient',
      'Self pay-TVFU',
      'Self-Pay Televisit 2nd FU',
      'Self-pay TVNP',
    ])
    expect(grouped.groups.find((group) => group.id === 'OV')?.types).toEqual([
      'Follow Up Visit',
      'New Patient',
      '2nd Follow up',
      'Self pay-NP',
      'Self pay-F/U',
      '2nd follow up Self pay',
    ])
    expect(grouped.ungrouped).toEqual([
      'Ultrasound',
      'Infusions',
      'Certified Medical Assistant Visit',
      'EHR Appointment',
    ])
  })

  it('classifies short codes', () => {
    expect(classifyVisitTypeGroup('TV FU')).toBe('TV')
    expect(classifyVisitTypeGroup('TVNP')).toBe('TV')
    expect(classifyVisitTypeGroup('NP')).toBe('OV')
    expect(classifyVisitTypeGroup('FUV')).toBe('OV')
    expect(classifyVisitTypeGroup('US')).toBe(null)
  })

  it('matches any selected child visit type', () => {
    const condition = {
      field: 'appointment.visitType',
      operator: 'equals' as const,
      value: ['Televisit Followup', 'Televisit New Patient', 'Self pay-TVFU'],
    }
    expect(
      evaluateConditions(condition, { appointment: { visitType: 'Televisit Followup' } })
    ).toBe(true)
    expect(
      evaluateConditions(condition, { appointment: { visitType: 'Follow Up Visit' } })
    ).toBe(false)
  })
})
