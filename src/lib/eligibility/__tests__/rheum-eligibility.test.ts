import { describe, expect, it } from 'vitest'
import { parseEligibilityResponse } from '@/lib/availity/parse-response'
import type { AvailityCoverageRecord } from '@/lib/availity/types'
import { scrapeRheumPacketFromPortalText } from '../scrape-rpa-benefits'
import {
  buildMedicareTxNonParPacket,
  requiresCallConfirmation,
  shouldRunEligibilityForAppointmentType,
} from '../lsr-gates'

describe('parseEligibilityResponse amounts → rheum packet', () => {
  it('extracts specialist copay, deductible, coinsurance, OOP from Availity amounts', () => {
    const record: AvailityCoverageRecord = {
      status: 'Complete',
      statusCode: '4',
      payer: { name: 'Aetna', payerId: 'AETNA' },
      plans: [
        {
          status: 'Active Coverage',
          statusCode: '1',
          insuranceType: 'Preferred Provider Organization (PPO)',
          groupNumber: 'G1',
          description: 'PPO Gold',
          benefits: [
            {
              name: 'Specialist Office Visit',
              type: '98',
              status: 'Active',
              amounts: {
                coPayment: { amount: '40.00', currency: 'USD' },
                deductible: { amount: '500.00', remaining: '250.00', met: '250.00' },
                coInsurance: { amount: '20' },
                outOfPocket: { amount: '3000.00', remaining: '2100.00' },
              },
            },
          ],
        },
      ],
    }

    const summary = parseEligibilityResponse(record)
    expect(summary.eligibilityStatus).toBe('active')
    expect(summary.planType).toBe('PPO')
    expect(summary.rheum?.specialistCopay).toBe('$40.00')
    expect(summary.rheum?.deductible?.total).toBe('$500.00')
    expect(summary.rheum?.deductible?.remaining).toBe('$250.00')
    expect(summary.rheum?.coinsurance).toBe('20%')
    expect(summary.rheum?.oop?.max).toBe('$3000.00')
    expect(summary.rheum?.source).toBe('availity_api')
  })
})

describe('scrapeRheumPacketFromPortalText', () => {
  it('parses common Availity result labels', () => {
    const packet = scrapeRheumPacketFromPortalText(
      `
      Active Coverage
      Plan Type: PPO
      In-Network benefits
      Specialist Copay: $55.00
      Deductible: $1000.00
      Deductible Remaining: $400.00
      Coinsurance: 20%
      Out of Pocket Max: $5000.00
      Referral not required
      Telehealth covered
      `,
      { source: 'availity_rpa' }
    )
    expect(packet.planType).toBe('PPO')
    expect(packet.networkStatus).toBe('inn')
    expect(packet.specialistCopay).toBe('$55.00')
    expect(packet.deductible?.total).toBe('$1000.00')
    expect(packet.deductible?.remaining).toBe('$400.00')
    expect(packet.coinsurance).toBe('20%')
    expect(packet.oop?.max).toBe('$5000.00')
    expect(packet.referralRequired).toBe(false)
    expect(packet.telehealthAllowed).toBe(true)
  })

  it('parses Availity Plan Maximums table copy (UHC Choice Plus style)', () => {
    const packet = scrapeRheumPacketFromPortalText(
      `
      Member Status Active Coverage
      Plan / Product: UNITEDHEALTHCARE CHOICE PLUS
      PROVIDER IS OUT NETWORK FOR MEMBER
      Auth Required
      A PRIOR AUTHORIZATION OR NOTIFICATION INQUIRY REQUEST MAY BE SUBMITTED
      Insurance Type: Commercial
      Plan Maximums and Deductibles
      Annual Deductible (In-Network)
      Individual: $3,200 total per calendar year. $2,553.13 is remaining. $646.87 has been applied Year to Date
      Family: $6,400 total per calendar year. $5,028.35 is remaining.
      Out of Pocket (In-Network)
      Individual: $5,500 total per calendar year. $4,446.04 is remaining.
      Family: $10,000 total per calendar year. $7,705.61 is remaining.
      Specialist Office Visit Copay: $40.00
      Coinsurance: 20%
      `,
      { source: 'availity_rpa' }
    )
    expect(packet.planType).toBe('Commercial')
    expect(packet.networkStatus).toBe('onn')
    expect(packet.authRequired).toBe(true)
    expect(packet.deductible?.total).toBe('$3200')
    expect(packet.deductible?.remaining).toBe('$2553.13')
    expect(packet.deductible?.met).toBe('$646.87')
    expect(packet.oop?.max).toBe('$5500')
    expect(packet.oop?.remaining).toBe('$4446.04')
    expect(packet.specialistCopay).toBe('$40.00')
    expect(packet.coinsurance).toBe('20%')
  })
})

describe('LSR gates', () => {
  it('skips self-pay and infusion appointment types', () => {
    expect(shouldRunEligibilityForAppointmentType('S-NP').run).toBe(false)
    expect(shouldRunEligibilityForAppointmentType('Infusion').run).toBe(false)
    expect(shouldRunEligibilityForAppointmentType('NP').run).toBe(true)
    expect(shouldRunEligibilityForAppointmentType('US').run).toBe(true)
  })

  it('requires call for televisit and ultrasound', () => {
    expect(requiresCallConfirmation('TVNP').required).toBe(true)
    expect(requiresCallConfirmation('US').required).toBe(true)
    expect(requiresCallConfirmation('FUV').required).toBe(false)
  })

  it('builds Medicare TX NON-PAR fixed copays', () => {
    const np = buildMedicareTxNonParPacket({ appointmentType: 'NP', isNewPatient: true })
    expect(np.specialistCopay).toBe('$226.76')
    expect(np.source).toBe('medicare_tx_nonpar')
    const tv = buildMedicareTxNonParPacket({ appointmentType: 'TV FU' })
    expect(tv.specialistCopay).toBe('$91.90')
    expect(tv.callRequired).toBe(true)
  })
})
