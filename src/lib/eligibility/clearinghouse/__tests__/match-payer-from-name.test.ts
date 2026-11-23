import { describe, expect, it } from 'vitest'
import {
  inheritPayerIdFromSiblings,
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

  it('maps Humana HMO to Humana when Stedi also returns dental and Medicare lines', () => {
    const humana: PayerSearchResult = {
      payerId: '61101',
      name: 'Humana',
      aliases: ['HUMANA'],
    }
    const humanaDental: PayerSearchResult = {
      payerId: 'HUMDEN',
      name: 'Humana Dental',
      aliases: ['HUMANA'],
    }
    const humanaMa: PayerSearchResult = {
      payerId: 'HUMMA',
      name: 'Humana Medicare Advantage',
      aliases: ['HUMANA'],
    }
    const match = pickConfidentPayerMatch([humanaDental, humanaMa, humana], 'Humana HMO')
    expect(match).toMatchObject({ status: 'matched', payerId: '61101', name: 'Humana' })
  })

  it('maps Cigna PPO to commercial Cigna, not HealthSpring', () => {
    const cigna: PayerSearchResult = {
      payerId: '81040',
      name: 'Cigna',
      aliases: ['CIGNA'],
    }
    const healthspring: PayerSearchResult = {
      payerId: '63092',
      name: 'Cigna HealthSpring',
      aliases: ['CIGNA', 'HealthSpring'],
    }
    const match = pickConfidentPayerMatch([healthspring, cigna], 'Cigna PPO')
    expect(match).toMatchObject({ status: 'matched', payerId: '81040', name: 'Cigna' })
  })
})

describe('resolvePayerIdFromName', () => {
  it('searches by eCW name and returns a confident Stedi ID', async () => {
    const searched: string[] = []
    const oscar: PayerSearchResult = {
      payerId: 'OSCAR',
      name: 'Oscar Health',
      aliases: ['Oscar'],
    }
    const match = await resolvePayerIdFromName({
      payerName: 'Oscar Health',
      searchPayers: async (query) => {
        searched.push(query)
        return [oscar, UHC]
      },
    })
    expect(match.status).toBe('matched')
    if (match.status === 'matched') expect(match.payerId).toBe('OSCAR')
    expect(searched.length).toBeGreaterThan(0)
    expect(searched.length).toBeLessThanOrEqual(4)
  })

  it('stops after the first confident match', async () => {
    let calls = 0
    const oscar: PayerSearchResult = {
      payerId: 'OSCAR',
      name: 'Oscar',
      aliases: ['Oscar Health'],
    }
    const match = await resolvePayerIdFromName({
      payerName: 'Oscar',
      searchPayers: async () => {
        calls += 1
        return [oscar, UHC]
      },
    })
    expect(match.status).toBe('matched')
    expect(calls).toBe(1)
  })

  it('maps Open Dental DentaQuest of Illinois without searching', async () => {
    let calls = 0
    const match = await resolvePayerIdFromName({
      payerName: 'DentaQuest of Illinois, LLC',
      preferDental: true,
      searchPayers: async () => {
        calls += 1
        return []
      },
    })
    expect(match).toMatchObject({ status: 'matched', payerId: 'CX014' })
    expect(calls).toBe(0)
  })

  it('maps Open Dental BLUE CROSS/BLUE SHIELD OF TX without searching', async () => {
    let calls = 0
    const match = await resolvePayerIdFromName({
      payerName: 'BLUE CROSS/BLUE SHIELD OF TX',
      preferDental: true,
      searchPayers: async () => {
        calls += 1
        return [BCBSTX, BCBSIL]
      },
    })
    expect(match).toMatchObject({ status: 'matched', payerId: 'G84980' })
    expect(calls).toBe(0)
  })

  it('maps parenthetical First Health and slash UnitedHealthcare labels without searching', async () => {
    expect(
      await resolvePayerIdFromName({
        payerName: "EMPLOYER'S HEALTH NETWORK (FIRST HEALTH)",
        searchPayers: async () => [],
      })
    ).toMatchObject({ status: 'matched', payerId: '82018' })
    expect(
      await resolvePayerIdFromName({
        payerName: 'UNITEDHEALTHCARE / GEHA',
        searchPayers: async () => [],
      })
    ).toMatchObject({ status: 'matched', payerId: '87726' })
  })

  it('maps eCW Humana HMO to Humana medical without searching', async () => {
    let calls = 0
    const match = await resolvePayerIdFromName({
      payerName: 'Humana HMO',
      searchPayers: async () => {
        calls += 1
        return []
      },
    })
    expect(match).toMatchObject({ status: 'matched', payerId: '61101', name: 'Humana' })
    expect(calls).toBe(0)
  })

  it('maps eCW COMMUNITY HEALTH CHOICED INC to Community Health Choice without searching', async () => {
    let calls = 0
    const match = await resolvePayerIdFromName({
      payerName: 'COMMUNITY HEALTH CHOICED INC',
      searchPayers: async () => {
        calls += 1
        return []
      },
    })
    expect(match).toMatchObject({ status: 'matched', payerId: '48145' })
    expect(calls).toBe(0)
  })

  it('reuses a Stedi ID already stored on another policy with the same brand', async () => {
    let calls = 0
    const match = await resolvePayerIdFromName({
      payerName: 'Devoted Health, Inc',
      siblingPayers: [{ payerNameRaw: 'DEVOTED HEALTH, INC', payerId: 'DEVTED' }],
      searchPayers: async () => {
        calls += 1
        return []
      },
    })
    expect(match).toMatchObject({ status: 'matched', payerId: 'DEVTED' })
    expect(calls).toBe(0)
  })

  it('does not reuse a commercial ID for a Medicare Advantage sibling', () => {
    expect(
      inheritPayerIdFromSiblings('Aetna Medicare Advantage', [
        { payerNameRaw: 'AETNA', payerId: '60054' },
      ])
    ).toBeNull()
  })
})
