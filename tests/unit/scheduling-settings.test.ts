import { describe, it, expect } from 'vitest'
import {
  resolveBookOperatoryNum,
  resolveBookOperatoryNums,
  resolveReadLengthMinutes,
  resolveReadOperatoryNum,
  resolveReadOperatoryNums,
  resolveReadPractitionerRef,
  resolveReadPractitionerRefs,
  resolveReadProvNum,
  resolveReadSource,
  resolveWriteSource,
  usesOpenDentalForRead,
  usesOpenDentalForWrite,
  usesEcwForRead,
  usesEcwForWrite,
  type SchedulingSettings,
} from '@/lib/integrations/clinical-system/types'

const base: SchedulingSettings = {
  mode: 'open_dental',
  readSource: 'open_dental',
  writeSource: 'open_dental',
  defaultReadProvNum: null,
  defaultReadOperatoryNum: 1,
  defaultReadOperatoryNums: [3, 4],
  defaultReadLengthMinutes: null,
  defaultProvNum: 24,
  defaultOperatoryNum: 2,
  defaultOperatoryNums: [5],
  defaultLengthMinutes: 30,
}

describe('scheduling source resolvers', () => {
  it('derives read/write from legacy mode when sources omitted', () => {
    expect(resolveReadSource({ mode: 'open_dental' })).toBe('open_dental')
    expect(resolveWriteSource({ mode: 'cal' })).toBe('cal')
  })

  it('prefers explicit readSource/writeSource over mode', () => {
    expect(
      resolveReadSource({ mode: 'cal', readSource: 'open_dental', writeSource: 'none' })
    ).toBe('open_dental')
    expect(
      resolveWriteSource({ mode: 'cal', readSource: 'open_dental', writeSource: 'none' })
    ).toBe('none')
  })

  it('detects open dental read vs write independently', () => {
    const readOnlyOd = { readSource: 'open_dental' as const, writeSource: 'none' as const }
    expect(usesOpenDentalForRead(readOnlyOd)).toBe(true)
    expect(usesOpenDentalForWrite(readOnlyOd)).toBe(false)
  })

  it('detects ecw read vs write independently', () => {
    const readOnlyEcw = { readSource: 'ecw' as const, writeSource: 'none' as const }
    expect(usesEcwForRead(readOnlyEcw)).toBe(true)
    expect(usesEcwForWrite(readOnlyEcw)).toBe(false)
  })
})

describe('scheduling settings resolvers', () => {
  describe('resolveReadProvNum', () => {
    it('prefers read provider over booking provider', () => {
      expect(resolveReadProvNum({ ...base, defaultReadProvNum: 10 })).toBe(10)
    })

    it('falls back to booking provider', () => {
      expect(resolveReadProvNum({ ...base, defaultReadProvNum: null })).toBe(24)
    })
  })

  describe('resolveReadLengthMinutes', () => {
    it('falls back to booking length', () => {
      expect(resolveReadLengthMinutes({ ...base, defaultReadLengthMinutes: null })).toBe(30)
    })
  })

  describe('resolveBookOperatoryNums', () => {
    it('returns primary plus additional booking operatories deduped', () => {
      expect(resolveBookOperatoryNums(base)).toEqual([2, 5])
    })

    it('returns only additional when primary is unset', () => {
      expect(
        resolveBookOperatoryNums({
          ...base,
          defaultOperatoryNum: null,
          defaultOperatoryNums: [5, 7, 5],
        })
      ).toEqual([5, 7])
    })

    it('dedupes primary when also listed in additional', () => {
      expect(
        resolveBookOperatoryNums({
          ...base,
          defaultOperatoryNum: 2,
          defaultOperatoryNums: [2, 5],
        })
      ).toEqual([2, 5])
    })
  })

  describe('resolveBookOperatoryNum', () => {
    it('returns first book operatory', () => {
      expect(resolveBookOperatoryNum(base)).toBe(2)
    })

    it('returns null when no book operatories configured', () => {
      expect(
        resolveBookOperatoryNum({
          ...base,
          defaultOperatoryNum: null,
          defaultOperatoryNums: [],
        })
      ).toBeNull()
    })
  })

  describe('resolveReadOperatoryNums', () => {
    it('returns primary read plus additional read operatories', () => {
      expect(resolveReadOperatoryNums(base)).toEqual([1, 3, 4])
    })

    it('falls back to book operatories when read primary is unset', () => {
      expect(
        resolveReadOperatoryNums({
          ...base,
          defaultReadOperatoryNum: null,
          defaultReadOperatoryNums: [],
        })
      ).toEqual([2, 5])
    })

    it('uses additional read operatories when primary read is unset', () => {
      expect(
        resolveReadOperatoryNums({
          ...base,
          defaultReadOperatoryNum: null,
          defaultReadOperatoryNums: [3, 4],
        })
      ).toEqual([3, 4])
    })
  })

  describe('resolveReadOperatoryNum', () => {
    it('returns first resolved read operatory', () => {
      expect(resolveReadOperatoryNum(base)).toBe(1)
    })
  })

  describe('resolveReadPractitionerRefs', () => {
    it('returns empty when no practitioner filter is configured', () => {
      expect(resolveReadPractitionerRefs({ readSource: 'ecw', writeSource: 'none' })).toEqual([])
    })

    it('merges array and legacy single ref without duplicates', () => {
      expect(
        resolveReadPractitionerRefs({
          readSource: 'ecw',
          writeSource: 'none',
          defaultReadPractitionerRefs: ['Practitioner/a', 'Practitioner/b'],
          defaultReadPractitionerRef: 'Practitioner/a',
        })
      ).toEqual(['Practitioner/a', 'Practitioner/b'])
    })

    it('falls back to write practitioner when read filter is empty', () => {
      expect(
        resolveReadPractitionerRef({
          readSource: 'ecw',
          writeSource: 'ecw',
          defaultWritePractitionerRef: 'Practitioner/z',
        })
      ).toBe('Practitioner/z')
    })
  })
})
