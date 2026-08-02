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
