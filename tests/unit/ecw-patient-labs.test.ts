import { describe, expect, it } from 'vitest'
import {
  assembleLabPanels,
  columnKeyForTest,
  displayOrderDate,
  matchOrderToReport,
  panelKeyFromLabel,
  sameLabInstant,
} from '@/lib/ehr/ecwPatientLabs'

describe('ecw patient labs', () => {
  it('maps panel labels and analyte columns', () => {
    expect(panelKeyFromLabel('CBC (INCLUDES DIFF/PLT) (6399)')).toBe('cbc')
    expect(panelKeyFromLabel('COMPREHENSIVE METABOLIC PANEL (10231)')).toBe('cmp')
    expect(columnKeyForTest('WHITE BLOOD CELL COUNT')).toBe('wbc')
    expect(columnKeyForTest('HEMOGLOBIN')).toBe('hemoglobin')
    expect(columnKeyForTest('CYCLIC CITRULLINATED PEPTIDE (CCP) AB (IGG)')).toBe('ccp')
  })

  it('uses occurrence date as the eCW order-date column', () => {
    expect(
      displayOrderDate({
        occurrenceDateTime: '2026-07-15T00:00:00-05:00',
        authoredOn: '2026-04-15T00:00:00-05:00',
      })
    ).toBe('2026-07-15T00:00:00-05:00')
  })

  it('matches a 7/15 future order to 8/18 collected results', () => {
    const matched = matchOrderToReport(
      [
        {
          id: 'sr-cbc-july',
          panelKey: 'cbc',
          occurrenceDateTime: '2026-07-15T00:00:00-05:00',
          collectionDateTime: '2026-08-18T09:00:00-05:00',
        },
      ],
      { panelKey: 'cbc', collectionDateTime: '2026-08-18T09:00:00-05:00' }
    )
    expect(matched?.id).toBe('sr-cbc-july')
    expect(sameLabInstant('2026-08-18T09:00:00-05:00', '2026-08-18T09:00:00.000-05:00')).toBe(true)
  })

  it('assembles a CBC row from report result references', () => {
    const assembled = assembleLabPanels({
      observations: [
        {
          resourceType: 'Observation',
          id: 'obs-wbc',
          code: { text: 'WHITE BLOOD CELL COUNT' },
          valueQuantity: { value: 5, unit: 'Thousand/uL' },
          interpretation: [{ coding: [{ code: 'N' }] }],
        },
        {
          resourceType: 'Observation',
          id: 'obs-hgb',
          code: { text: 'HEMOGLOBIN' },
          valueQuantity: { value: 13.7, unit: 'g/dL' },
          interpretation: [{ coding: [{ code: 'N' }] }],
        },
      ],
      reports: [
        {
          resourceType: 'DiagnosticReport',
          id: 'dr-cbc',
          code: { text: 'CBC (INCLUDES DIFF/PLT) (6399)' },
          effectiveDateTime: '2026-08-18T09:00:00-05:00',
          issued: '2026-08-18T09:00:00.000-05:00',
          status: 'final',
          result: [{ reference: 'Observation/obs-wbc' }, { reference: 'Observation/obs-hgb' }],
        },
      ],
      orders: [
        {
          resourceType: 'ServiceRequest',
          id: 'sr-cbc',
          status: 'completed',
          code: { text: 'CBC (INCLUDES DIFF/PLT) (6399)' },
          authoredOn: '2026-04-15T00:00:00-05:00',
          occurrenceDateTime: '2026-07-15T00:00:00-05:00',
          extension: [
            {
              url: 'http://eclinicalworks.com/supportingInfo/serviceRequestOrder/collectionDate',
              valueDateTime: '2026-08-18T09:00:00-05:00',
            },
            {
              url: 'http://eclinicalworks.com/supportingInfo/serviceRequestOrder/receivedDate',
              valueDateTime: '2026-08-19T00:00:00-05:00',
            },
            {
              url: 'http://eclinicalworks.com/supportingInfo/serviceRequestOrder/status',
              valueString: 'Reviewed',
            },
          ],
        },
      ],
    })

    const cbc = assembled.panels.find((panel) => panel.key === 'cbc')
    expect(cbc?.rows[0]?.orderDate).toBe('2026-07-15T00:00:00-05:00')
    expect(cbc?.rows[0]?.resultDate).toBe('2026-08-19T00:00:00-05:00')
    expect(cbc?.rows[0]?.values.wbc.value).toBe('5 Thousand/uL')
    expect(cbc?.rows[0]?.values.hemoglobin.value).toBe('13.7 g/dL')
  })

  it('skips non-lab diagnostic reports with no analyte columns', () => {
    const assembled = assembleLabPanels({
      observations: [],
      reports: [
        {
          resourceType: 'DiagnosticReport',
          id: 'dr-us',
          code: { text: 'Ultrasound : Extremity Ultrasound Non-Vasc' },
          effectiveDateTime: '2026-01-01T00:00:00-05:00',
          status: 'final',
          result: [],
        },
      ],
      orders: [],
    })
    expect(assembled.panels.find((panel) => panel.key === 'other')).toBeUndefined()
  })
})
