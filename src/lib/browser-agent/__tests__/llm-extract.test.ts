import { describe, expect, it } from 'vitest'
import {
  availityResultExtractSchema,
  mapExtractToRheumPacket,
} from '../llm-extract'
import { createEmptyRheumPacket } from '@/lib/eligibility/rheum-packet'

describe('availityResultExtractSchema', () => {
  it('parses a Lonestar-shaped fixture', () => {
    const fixture = {
      memberStatus: 'Active Coverage',
      networkStatus: 'inn',
      planType: 'PPO',
      specialistCopay: '$40',
      coinsurance: '20%',
      limitations: 'None',
      authRequired: false,
      deductible: { total: '$1500', met: '$200', remaining: '$1300' },
      oop: { max: '$6000', met: '$450', remaining: '$5550' },
    }
    const parsed = availityResultExtractSchema.parse(fixture)
    expect(parsed.memberStatus).toBe('Active Coverage')
    expect(parsed.networkStatus).toBe('inn')
    expect(parsed.deductible?.remaining).toBe('$1300')
  })
})

describe('mapExtractToRheumPacket', () => {
  it('maps extract fields into a rheum packet', () => {
    const packet = mapExtractToRheumPacket({
      memberStatus: 'Active Coverage',
      networkStatus: 'inn',
      planType: 'PPO',
      specialistCopay: '$40.00',
      coinsurance: '20%',
      authRequired: true,
      deductible: { total: '$1,500.00', met: '$100.00', remaining: '$1,400.00' },
      oop: { max: '$6,000.00', met: null, remaining: '$5,900.00' },
    })

    expect(packet.memberStatus).toBe('Active Coverage')
    expect(packet.networkStatus).toBe('inn')
    expect(packet.planType).toBe('PPO')
    expect(packet.specialistCopay).toBe('$40.00')
    expect(packet.coinsurance).toBe('20%')
    expect(packet.authRequired).toBe(true)
    expect(packet.deductible?.total).toBe('$1,500.00')
    expect(packet.deductible?.remaining).toBe('$1,400.00')
    expect(packet.oop?.max).toBe('$6,000.00')
    expect(packet.oop?.remaining).toBe('$5,900.00')
    expect(packet.source).toBe('availity_rpa')
  })

  it('merges extract over heuristic scrape without wiping money fields', () => {
    const heuristic = createEmptyRheumPacket('office_visit', 'availity_rpa')
    heuristic.memberStatus = 'Active Coverage'
    heuristic.specialistCopay = '$35'
    heuristic.deductible = { total: '$2000', met: '$50', remaining: '$1950' }

    const packet = mapExtractToRheumPacket(
      {
        networkStatus: 'inn',
        planType: 'HMO',
        deductible: { remaining: '$1800' },
      },
      { formMode: 'office_visit', heuristic }
    )

    expect(packet.memberStatus).toBe('Active Coverage')
    expect(packet.specialistCopay).toBe('$35')
    expect(packet.networkStatus).toBe('inn')
    expect(packet.planType).toBe('HMO')
    expect(packet.deductible?.total).toBe('$2000')
    expect(packet.deductible?.met).toBe('$50')
    expect(packet.deductible?.remaining).toBe('$1800')
  })
})
