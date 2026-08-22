import { describe, expect, it } from 'vitest'
import {
  pickConfidentPayerMatch,
  resolvePayerIdFromName,
} from '../match-payer-from-name'
import type { PayerSearchResult } from '../types'

const AETNA: PayerSearchResult = {
  payerId: '60054',
  name: 'Aetna',
  aliases: ['AETNA'],
}
const BCBSTX: PayerSearchResult = {
  payerId: 'G84980',
  name: 'Blue Cross Blue Shield of Texas',
  aliases: ['84980', 'TXBCBS', 'Blue Cross and Blue Shield of Texas'],
}
const BCBSIL: PayerSearchResult = {
  payerId: '00621',
  name: 'Blue Cross Blue Shield of Illinois',
  aliases: ['BCBS of Illinois'],
}
const BCBSTX_MA: PayerSearchResult = {
  payerId: 'TXMA',
  name: 'Blue Cross Medicare Advantage',
  aliases: ['BCBS Texas Medicare Advantage'],
}
const UHC: PayerSearchResult = {
  payerId: '87726',
  name: 'UnitedHealthcare',
  aliases: ['UHC'],
}

describe('pickConfidentPayerMatch', () => {
  it('maps an eCW brand name like AETNA to the Stedi payer ID', () => {
    const match = pickConfidentPayerMatch([AETNA, UHC, BCBSTX], 'AETNA')
    expect(match).toMatchObject({ status: 'matched', payerId: '60054' })
  })

  it('picks commercial Aetna over Aetna Better Health when the CRM name is AETNA', () => {
    const betterHealth: PayerSearchResult = {
      payerId: 'ABH',
      name: 'Aetna Better Health',
      aliases: ['AETNA', 'Aetna'],
    }
    const match = pickConfidentPayerMatch([betterHealth, AETNA], 'AETNA')
    expect(match).toMatchObject({ status: 'matched', payerId: '60054', name: 'Aetna' })
  })

  it('prefers Aetna Dental over commercial Aetna when dental STCs are selected', () => {
    const aetnaDental: PayerSearchResult = {
      payerId: 'AETNADEN',
      name: 'Aetna Dental',
      aliases: ['AETNA', 'Aetna'],
    }
    const match = pickConfidentPayerMatch([aetnaDental, AETNA], 'AETNA', { preferDental: true })
    expect(match).toMatchObject({ status: 'matched', payerId: 'AETNADEN', name: 'Aetna Dental' })
  })

  it('maps Blue Cross and Blue Shield of Texas, not another BCBS plan', () => {
    const match = pickConfidentPayerMatch(
      [BCBSTX, BCBSIL, BCBSTX_MA],
      'Blue Cross and Blue Shield of Texas'
    )
    expect(match).toMatchObject({ status: 'matched', payerId: 'G84980', name: BCBSTX.name })
  })

  it('does not pick Medicare Advantage for a commercial BCBSTX label', () => {
    const match = pickConfidentPayerMatch([BCBSTX, BCBSTX_MA], 'BCBSTX')
    expect(match.status).toBe('matched')
    if (match.status === 'matched') expect(match.payerId).toBe('G84980')
  })

  it('returns ambiguous when two BCBS state plans score too closely', () => {
    const match = pickConfidentPayerMatch([BCBSTX, BCBSIL], 'Blue Cross Blue Shield')
    expect(match.status).toBe('ambiguous')
  })

  it('returns none when nothing scores', () => {
    expect(pickConfidentPayerMatch([UHC], 'Memorial Hermann Health Network').status).toBe('none')
  })
})

describe('resolvePayerIdFromName', () => {
  it('searches by eCW name and returns a confident Stedi ID', async () => {
    const searched: string[] = []
    const match = await resolvePayerIdFromName({
      payerName: 'Blue Cross and Blue Shield of Texas',
      searchPayers: async (query) => {
        searched.push(query)
        return [BCBSTX, BCBSIL, UHC]
      },
    })
    expect(match.status).toBe('matched')
    if (match.status === 'matched') expect(match.payerId).toBe('G84980')
    expect(searched.length).toBeGreaterThan(0)
    expect(searched.length).toBeLessThanOrEqual(3)
  })

  it('stops after the first confident match', async () => {
    let calls = 0
    const match = await resolvePayerIdFromName({
      payerName: 'AETNA',
      searchPayers: async () => {
        calls += 1
        return [AETNA, UHC]
      },
    })
    expect(match.status).toBe('matched')
    expect(calls).toBe(1)
  })
})
