import { describe, expect, it } from 'vitest'
import {
  expandRequestedServiceTypeCodes,
  normalizeServiceTypeCodes,
  orderServiceTypeCodesForRequest,
  primaryServiceTypeCode,
} from '../service-types'

describe('normalizeServiceTypeCodes', () => {
  it('defaults to 30 when empty', () => {
    expect(normalizeServiceTypeCodes(undefined)).toEqual(['30'])
    expect(normalizeServiceTypeCodes([])).toEqual(['30'])
    expect(normalizeServiceTypeCodes('')).toEqual(['30'])
  })

  it('parses a comma-separated string and de-dupes', () => {
    expect(normalizeServiceTypeCodes('35, 23, 35, 41')).toEqual(['35', '23', '41'])
  })

  it('keeps a selected dental list', () => {
    expect(normalizeServiceTypeCodes(['35', '23', '41'])).toEqual(['35', '23', '41'])
    expect(primaryServiceTypeCode(['35', '23', '41'])).toBe('35')
  })

  it('puts general codes first regardless of click order', () => {
    expect(normalizeServiceTypeCodes(['23', '41', '35'])).toEqual(['35', '23', '41'])
  })
})

describe('orderServiceTypeCodesForRequest', () => {
  it('sends only dental 35 when 35 is selected, dropping medical and sibling STCs', () => {
    expect(orderServiceTypeCodesForRequest(['30', '35', '1', '23', '41'])).toEqual(['35'])
  })

  it('sends only medical 30 when 30 is selected without 35', () => {
    expect(orderServiceTypeCodesForRequest(['30', '98', '88'])).toEqual(['30'])
  })

  it('keeps a specific STC list when no general 30/35 is selected', () => {
    expect(orderServiceTypeCodesForRequest(['98', 'UC'])).toEqual(['98', 'UC'])
  })
})

describe('expandRequestedServiceTypeCodes', () => {
  it('includes dental category codes when 35 is selected', () => {
    const expanded = expandRequestedServiceTypeCodes(['35'])
    expect(expanded).toEqual(expect.arrayContaining(['35', '23', '41', '25']))
    expect(expanded).not.toContain('98')
  })
})
