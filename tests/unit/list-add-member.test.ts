import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addPatientToList } from '@/lib/lists/add-member'
import { prisma } from '@/lib/db'
import { emitEvent } from '@/lib/outbox'
import { ensurePatientListTag } from '@/lib/lists/import-csv'

vi.mock('@/lib/db', () => ({
  prisma: {
    patientList: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
    },
    patientListMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/outbox', () => ({
  emitEvent: vi.fn(),
}))

vi.mock('@/lib/lists/import-csv', () => ({
  ensurePatientListTag: vi.fn(),
}))

describe('addPatientToList', () => {
  const list = { id: 'list-1', name: 'New infusion follow up', memberCount: 0 }
  const patient = {
    id: 'patient-1',
    name: 'Jane Doe',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+15551234567',
    primaryPhone: '+15551234567',
    dateOfBirth: new Date('1990-01-15T00:00:00.000Z'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.patientList.findFirst as any).mockResolvedValue(list)
    ;(prisma.patient.findFirst as any).mockResolvedValue(patient)
    ;(prisma.patientListMember.findUnique as any).mockResolvedValue(null)
    ;(prisma.patientListMember.create as any).mockResolvedValue({
      id: 'member-1',
      listId: list.id,
      patientId: patient.id,
      source: 'manual',
      matchedBy: null,
      createdAt: new Date(),
      patient,
    })
    ;(prisma.patientList.update as any).mockResolvedValue({
      ...list,
      memberCount: 1,
    })
    ;(ensurePatientListTag as any).mockResolvedValue(undefined)
    ;(emitEvent as any).mockResolvedValue(undefined)
  })

  it('adds a patient, tags them, increments count, and emits member_added', async () => {
    const result = await addPatientToList({
      practiceId: 'practice-1',
      listId: list.id,
      patientId: patient.id,
    })

    expect(result.status).toBe('added')
    expect(ensurePatientListTag).toHaveBeenCalledWith(patient.id, list.name)
    expect(prisma.patientListMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          practiceId: 'practice-1',
          listId: list.id,
          patientId: patient.id,
          source: 'manual',
        }),
      })
    )
    expect(prisma.patientList.update).toHaveBeenCalledWith({
      where: { id: list.id },
      data: { memberCount: { increment: 1 } },
      select: { id: true, name: true, memberCount: true },
    })
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceId: 'practice-1',
        eventName: 'crm/list.member_added',
        entityId: patient.id,
      })
    )
  })

  it('returns already_member without creating a duplicate membership', async () => {
    ;(prisma.patientListMember.findUnique as any).mockResolvedValue({
      id: 'member-1',
      listId: list.id,
      patientId: patient.id,
      source: 'csv',
      matchedBy: 'email',
      createdAt: new Date(),
      patient,
    })

    const result = await addPatientToList({
      practiceId: 'practice-1',
      listId: list.id,
      patientId: patient.id,
    })

    expect(result.status).toBe('already_member')
    expect(ensurePatientListTag).toHaveBeenCalled()
    expect(prisma.patientListMember.create).not.toHaveBeenCalled()
    expect(prisma.patientList.update).not.toHaveBeenCalled()
    expect(emitEvent).not.toHaveBeenCalled()
  })

  it('throws when the list is missing', async () => {
    ;(prisma.patientList.findFirst as any).mockResolvedValue(null)
    await expect(
      addPatientToList({
        practiceId: 'practice-1',
        listId: 'missing',
        patientId: patient.id,
      })
    ).rejects.toThrow('List not found')
  })

  it('throws when the patient is missing', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue(null)
    await expect(
      addPatientToList({
        practiceId: 'practice-1',
        listId: list.id,
        patientId: 'missing',
      })
    ).rejects.toThrow('Patient not found')
  })
})
