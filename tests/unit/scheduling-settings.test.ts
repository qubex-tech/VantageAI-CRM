import { describe, it, expect } from 'vitest'
import {
  resolveBookOperatoryNum,
  resolveBookOperatoryNums,
  resolveReadLengthMinutes,
  resolveReadOperatoryNum,
  resolveReadOperatoryNums,
  resolveReadProvNum,
  type SchedulingSettings,
} from '@/lib/integrations/clinical-system/types'

const base: SchedulingSettings = {
  mode: 'open_dental',
  defaultReadProvNum: null,
  defaultReadOperatoryNum: 1,
  defaultReadOperatoryNums: [3, 4],
  defaultReadLengthMinutes: null,
  defaultProvNum: 24,
  defaultOperatoryNum: 2,
  defaultOperatoryNums: [5],
  defaultLengthMinutes: 30,
}

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
})
