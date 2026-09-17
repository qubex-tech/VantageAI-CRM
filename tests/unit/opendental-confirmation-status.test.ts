import { describe, it, expect } from 'vitest'
import {
  extractOpenDentalConfirmed,
  getOdConfirmationChipClasses,
} from '@/lib/integrations/opendental/confirmationStatus'

describe('extractOpenDentalConfirmed', () => {
  it('reads DefNum and display label from OD appointment payloads', () => {
    expect(
      extractOpenDentalConfirmed({ Confirmed: 42, confirmed: 'eConfirmSent' })
    ).toEqual({ defNum: 42, label: 'eConfirmSent' })
  })

  it('tolerates missing or empty values', () => {
    expect(extractOpenDentalConfirmed({})).toEqual({ defNum: null, label: null })
    expect(extractOpenDentalConfirmed({ Confirmed: 0, confirmed: '  ' })).toEqual({
      defNum: null,
      label: null,
    })
  })
})

describe('getOdConfirmationChipClasses', () => {
  it('styles common OD confirmation labels', () => {
    expect(getOdConfirmationChipClasses('Confirmed')).toContain('emerald')
    expect(getOdConfirmationChipClasses('eConfirmSent')).toContain('amber')
    expect(getOdConfirmationChipClasses('Arrived')).toContain('sky')
    expect(getOdConfirmationChipClasses('eConfirmFailure')).toContain('rose')
  })
})
