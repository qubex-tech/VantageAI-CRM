import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createdPolicies } = vi.hoisted(() => ({
  createdPolicies: [] as Record<string, unknown>[],
}))
import {
  mapOpenDentalFamilyInsuranceRow,
  mapOpenDentalPlanType,
  mapOpenDentalRelationship,
  resolveOpenDentalMemberId,
  syncOpenDentalInsuranceForPatient,
} from '@/lib/integrations/opendental/insuranceSync'

vi.mock('@/lib/integrations/opendental/factory', () => ({
  getOpenDentalConnection: vi.fn(),
  getOpenDentalClient: vi.fn(),
  getOpenDentalServices: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    patient: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    insurancePolicy: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      insurancePolicy: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          createdPolicies.push(data)
          return { id: 'policy-1', ...data }
        }),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      patient: {
        update: vi.fn(),
      },
    })),
  },
}))

vi.mock('@/lib/audit', () => ({
  createTimelineEntry: vi.fn(),
}))

import { getOpenDentalClient, getOpenDentalConnection, getOpenDentalServices } from '@/lib/integrations/opendental/factory'
import { prisma } from '@/lib/db'
import { createTimelineEntry } from '@/lib/audit'

describe('Open Dental insurance mapping', () => {
  it('prefers PatID over SubscriberID for memberId', () => {
    expect(
      resolveOpenDentalMemberId({
        PatID: 'PAT-9',
        SubscriberID: '541147842',
        PatPlanNum: 17,
      })
    ).toBe('PAT-9')
  })

  it('falls back to OD-PATPLAN when IDs are blank', () => {
    expect(resolveOpenDentalMemberId({ PatID: '', SubscriberID: '', PatPlanNum: 18 })).toBe(
      'OD-PATPLAN-18'
    )
  })

  it('maps plan type codes and relationships', () => {
    expect(mapOpenDentalPlanType('p', 'PPO Percentage')).toBe('PPO')
    expect(mapOpenDentalPlanType('c', 'Capitation')).toBe('HMO')
    expect(mapOpenDentalRelationship('Spouse')).toBe('Spouse')
    expect(mapOpenDentalRelationship('LifePartner')).toBe('Other')
    expect(mapOpenDentalRelationship('Self')).toBeNull()
  })

  it('maps a FamilyModules insurance row into CRM-shaped coverage', () => {
    const coverage = mapOpenDentalFamilyInsuranceRow(
      {
        PatNum: 13,
        InsSubNum: 7,
        Subscriber: 10,
        subscriber: 'Eve Wilkins',
        SubscriberID: '541147842',
        PatPlanNum: 17,
        Ordinal: 1,
        ordinal: 'Primary',
        IsPending: 'false',
        Relationship: 'LifePartner',
        PatID: '',
        CarrierNum: 8,
        CarrierName: 'BCBS',
        PlanNum: 7,
        GroupName: '',
        GroupNum: 'GRP1',
        PlanType: '',
        planType: 'Category Percentage',
        employer: '',
      },
      { phone: '8005551212', electId: 'SB600' }
    )

    expect(coverage).toMatchObject({
      patPlanNum: 17,
      memberId: '541147842',
      payerNameRaw: 'BCBS',
      insurerPhoneRaw: '8005551212',
      groupNumber: 'GRP1',
      planName: 'Category Percentage',
      planType: 'Other',
      isPrimary: true,
      subscriberIsPatient: false,
      subscriberFirstName: 'Eve',
      subscriberLastName: 'Wilkins',
      subscriberPatNum: 10,
      relationshipToPatient: 'Other',
      availityPayerId: 'SB600',
    })
  })
})

describe('syncOpenDentalInsuranceForPatient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createdPolicies.length = 0
  })

  it('upserts InsurancePolicy rows from FamilyModules insurance', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'patient-1',
      externalEhrId: 'opendental:13',
    } as never)
    vi.mocked(getOpenDentalConnection).mockResolvedValue({ isActive: true } as never)
    vi.mocked(getOpenDentalClient).mockResolvedValue({
      get: vi.fn().mockResolvedValue([
        {
          PatNum: 13,
          InsSubNum: 16,
          Subscriber: 13,
          subscriber: 'John Wilkins',
          SubscriberID: '987654',
          PatPlanNum: 18,
          Ordinal: 1,
          ordinal: 'Primary',
          IsPending: 'false',
          Relationship: 'Self',
          PatID: '',
          CarrierNum: 9,
          CarrierName: 'Metlife Dental',
          PlanNum: 11,
          GroupName: 'Happy Dental',
          GroupNum: 'G-22',
          PlanType: 'p',
          planType: 'PPO Percentage',
        },
      ]),
    } as never)
    vi.mocked(getOpenDentalServices).mockResolvedValue({
      carriers: {
        get: vi.fn().mockResolvedValue({ Phone: '2125550100', ElectID: 'ML123' }),
      },
    } as never)

    const result = await syncOpenDentalInsuranceForPatient({
      practiceId: 'practice-1',
      patientId: 'patient-1',
    })

    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.syncedCount).toBe(1)
    expect(result.policies[0]).toMatchObject({
      payerNameRaw: 'Metlife Dental',
      memberId: '987654',
      isPrimary: true,
    })
    expect(createTimelineEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Insurance synced from Open Dental',
        metadata: expect.objectContaining({ source: 'opendental' }),
      })
    )
  })

  it('loads ElectID with ShortQuery when GET /carriers is unsupported and stores it as the Stedi payer ID', async () => {
    const put = vi.fn().mockResolvedValue([
      { CarrierNum: 158, ElectID: '05030', Phone: '(800)323-1743' },
    ])
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'patient-1',
      externalEhrId: 'opendental:4931',
    } as never)
    vi.mocked(getOpenDentalConnection).mockResolvedValue({ isActive: true } as never)
    vi.mocked(getOpenDentalClient).mockResolvedValue({
      get: vi.fn().mockResolvedValue([
        {
          PatNum: 4931,
          InsSubNum: 20,
          Subscriber: 4931,
          subscriber: 'David Geataz',
          SubscriberID: 'MEM1',
          PatPlanNum: 30,
          Ordinal: 1,
          Relationship: 'Self',
          CarrierNum: 158,
          CarrierName: 'Delta Dental of IL',
          GroupNum: 'G1',
          PlanType: 'p',
        },
      ]),
      put,
    } as never)
    vi.mocked(getOpenDentalServices).mockResolvedValue({
      carriers: {
        get: vi.fn().mockRejectedValue(new Error('"carriers GET  is not a valid method."')),
      },
    } as never)

    const result = await syncOpenDentalInsuranceForPatient({
      practiceId: 'practice-1',
      patientId: 'patient-1',
    })

    expect(result.status).toBe('success')
    expect(put).toHaveBeenCalledWith(
      'queries/ShortQuery',
      expect.objectContaining({
        body: expect.objectContaining({
          SqlCommand: expect.stringContaining('CarrierNum IN (158)'),
        }),
      })
    )
    expect(createdPolicies[0]).toMatchObject({
      payerNameRaw: 'Delta Dental of IL',
      availityPayerId: '05030',
      insurerPhoneRaw: '(800)323-1743',
      clearinghousePayerIds: { stedi: '05030' },
    })
  })

  it('skips when Open Dental is not configured', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'patient-1',
      externalEhrId: 'opendental:13',
    } as never)
    vi.mocked(getOpenDentalConnection).mockResolvedValue({ isActive: false } as never)

    await expect(
      syncOpenDentalInsuranceForPatient({
        practiceId: 'practice-1',
        patientId: 'patient-1',
      })
    ).resolves.toEqual({ status: 'skipped', reason: 'opendental_not_configured' })
  })
})
