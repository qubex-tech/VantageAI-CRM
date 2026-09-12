import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatEhrReferralSpeakable,
  formatOpenDentalSpecialistName,
  groupVoiceEhrReferrals,
  mapOpenDentalRefAttach,
  normalizeOpenDentalReferralType,
  syncOpenDentalReferralsForPatient,
  toVoiceEhrReferral,
} from '@/lib/integrations/opendental/referralSync'

vi.mock('@/lib/integrations/opendental/factory', () => ({
  getOpenDentalConnection: vi.fn(),
  getOpenDentalServices: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    patient: {
      findFirst: vi.fn(),
    },
    patientEhrReferral: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        patientEhrReferral: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
            id: 'ref-1',
            ...data,
          })),
          update: vi.fn(),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      })
    ),
  },
}))

vi.mock('@/lib/audit', () => ({
  createTimelineEntry: vi.fn(),
}))

import { getOpenDentalConnection, getOpenDentalServices } from '@/lib/integrations/opendental/factory'
import { prisma } from '@/lib/db'
import { createTimelineEntry } from '@/lib/audit'

describe('Open Dental referral mapping', () => {
  it('normalizes referral types and specialist names', () => {
    expect(normalizeOpenDentalReferralType('RefTo')).toBe('RefTo')
    expect(normalizeOpenDentalReferralType('unknown')).toBe('RefCustom')
    expect(
      formatOpenDentalSpecialistName(
        { FName: 'Norm', LName: 'Davidson', Title: 'DMD' },
        'Steve N Stevens, DDS'
      )
    ).toBe('Norm Davidson, DMD')
    expect(formatOpenDentalSpecialistName({ BusinessName: 'Oral Surgery Center' }, null)).toBe(
      'Oral Surgery Center'
    )
    expect(formatOpenDentalSpecialistName(null, 'Bokish')).toBe('Bokish')
  })

  it('maps a RefTo attach and builds a speakable outgoing summary', () => {
    const mapped = mapOpenDentalRefAttach(
      {
        RefAttachNum: 568,
        ReferralNum: 17,
        referralName: 'Bokish',
        ReferralType: 'RefTo',
        RefToStatus: 'Scheduled',
        RefDate: '2023-12-05',
        Note: 'Called to confirm',
        ProvNum: 8,
        ProcNum: 1192,
      },
      {
        FName: 'James',
        LName: 'Bokish',
        Title: 'DDS',
        specialty: 'Oral Surgery',
        Telephone: '6305550100',
        IsDoctor: 'true',
      }
    )

    expect(mapped).toMatchObject({
      externalAttachId: '568',
      externalReferralId: '17',
      referralType: 'RefTo',
      status: 'Scheduled',
      specialistName: 'James Bokish, DDS',
      specialistSpecialty: 'Oral Surgery',
      specialistPhone: '6305550100',
      referringProvNum: 8,
      procNum: 1192,
    })
    expect(mapped?.referralDate?.toISOString().startsWith('2023-12-05')).toBe(true)
    expect(formatEhrReferralSpeakable(mapped!)).toBe(
      'Referred to James Bokish, DDS, Oral Surgery on December 5, 2023. Status: scheduled.'
    )
  })

  it('maps incoming referrals and ignores empty OD dates', () => {
    const mapped = mapOpenDentalRefAttach({
      RefAttachNum: 1,
      ReferralNum: 3,
      referralName: 'Steve N Stevens, DDS',
      ReferralType: 'RefFrom',
      RefToStatus: 'None',
      RefDate: '0001-01-01',
    })

    expect(mapped).toMatchObject({
      referralType: 'RefFrom',
      status: 'None',
      referralDate: null,
      specialistName: 'Steve N Stevens, DDS',
    })
    expect(formatEhrReferralSpeakable(mapped!)).toBe(
      'Referred to this office by Steve N Stevens, DDS.'
    )
  })

  it('groups voice payloads outgoing-first', () => {
    const grouped = groupVoiceEhrReferrals([
      toVoiceEhrReferral({
        referralType: 'RefFrom',
        specialistName: 'Jones',
      }),
      toVoiceEhrReferral({
        referralType: 'RefTo',
        specialistName: 'Smith',
        specialistSpecialty: 'Endodontics',
        status: 'Complete',
        referralDate: new Date(Date.UTC(2026, 2, 12)),
      }),
    ])

    expect(grouped.outgoing).toHaveLength(1)
    expect(grouped.incoming).toHaveLength(1)
    expect(grouped.speakable_summaries[0]).toContain('Referred to Smith')
    expect(grouped.speakable_summaries[1]).toContain('Referred to this office by Jones')
  })
})

describe('Open Dental referral sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'pat-1',
      externalEhrId: 'opendental:25',
    } as never)
    vi.mocked(getOpenDentalConnection).mockResolvedValue({ isActive: true } as never)
    vi.mocked(getOpenDentalServices).mockResolvedValue({
      refAttaches: {
        list: vi.fn().mockResolvedValue([
          {
            RefAttachNum: 1,
            ReferralNum: 3,
            referralName: 'Steve N Stevens, DDS',
            ReferralType: 'RefFrom',
            RefToStatus: 'None',
            RefDate: '2022-01-05',
          },
        ]),
      },
      referrals: {
        get: vi.fn().mockResolvedValue({
          ReferralNum: 3,
          FName: 'Steve',
          LName: 'Stevens',
          Title: 'DDS',
          specialty: 'Endodontics',
          Telephone: '5033635432',
          IsDoctor: 'true',
        }),
      },
    } as never)
  })

  it('skips patients that are not linked to Open Dental', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'pat-1',
      externalEhrId: 'ecw:99',
    } as never)

    await expect(
      syncOpenDentalReferralsForPatient({ practiceId: 'prac-1', patientId: 'pat-1' })
    ).resolves.toEqual({ status: 'skipped', reason: 'patient_not_linked_to_opendental' })
  })

  it('upserts live attaches and prunes stale CRM rows', async () => {
    const create = vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'ref-new',
      ...data,
    }))
    const update = vi.fn()
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 })
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
      (fn as (tx: unknown) => Promise<unknown>)({
        patientEhrReferral: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'stale-1', externalAttachId: '999' },
          ]),
          create,
          update,
          deleteMany,
        },
      })
    )

    const result = await syncOpenDentalReferralsForPatient({
      practiceId: 'prac-1',
      patientId: 'pat-1',
      externalEhrId: 'opendental:25',
    })

    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.fetched).toBe(1)
    expect(result.created).toBe(1)
    expect(result.pruned).toBe(1)
    expect(create).toHaveBeenCalled()
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['stale-1'] }, patientId: 'pat-1', practiceId: 'prac-1' },
    })
    expect(createTimelineEntry).toHaveBeenCalled()
    expect(result.referrals[0]).toMatchObject({
      specialistName: 'Steve Stevens, DDS',
      specialistSpecialty: 'Endodontics',
      referralType: 'RefFrom',
    })
  })
})
