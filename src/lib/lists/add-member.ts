import { prisma } from '@/lib/db'
import { emitEvent } from '@/lib/outbox'
import { ensurePatientListTag } from '@/lib/lists/import-csv'

export type AddPatientToListResult = {
  status: 'added' | 'already_member'
  member: {
    id: string
    listId: string
    patientId: string
    source: string
    matchedBy: string | null
    createdAt: Date
    patient: {
      id: string
      name: string
      firstName: string | null
      lastName: string | null
      email: string | null
      phone: string
      primaryPhone: string | null
      dateOfBirth: Date | null
    }
  }
  list: {
    id: string
    name: string
    memberCount: number
  }
}

function patientPayloadForEvent(patient: {
  id: string
  name: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  primaryPhone?: string | null
  dateOfBirth: Date | null
}) {
  return {
    id: patient.id,
    name: patient.name,
    firstName: patient.firstName ?? null,
    lastName: patient.lastName ?? null,
    email: patient.email ?? null,
    phone: patient.primaryPhone || patient.phone || null,
    primaryPhone: patient.primaryPhone ?? null,
    dateOfBirth: patient.dateOfBirth?.toISOString() ?? null,
  }
}

/**
 * Add an existing patient to a list: tag with list name, create membership,
 * bump memberCount, and emit crm/list.member_added when newly added.
 */
export async function addPatientToList(params: {
  practiceId: string
  listId: string
  patientId: string
  source?: string
  matchedBy?: string | null
  emitMemberAdded?: boolean
}): Promise<AddPatientToListResult> {
  const source = params.source || 'manual'
  const matchedBy = params.matchedBy ?? null

  const list = await prisma.patientList.findFirst({
    where: { id: params.listId, practiceId: params.practiceId },
    select: { id: true, name: true, memberCount: true },
  })
  if (!list) {
    throw new Error('List not found')
  }

  const patient = await prisma.patient.findFirst({
    where: {
      id: params.patientId,
      practiceId: params.practiceId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      primaryPhone: true,
      dateOfBirth: true,
    },
  })
  if (!patient) {
    throw new Error('Patient not found')
  }

  await ensurePatientListTag(patient.id, list.name)

  const existingMember = await prisma.patientListMember.findUnique({
    where: {
      listId_patientId: {
        listId: params.listId,
        patientId: patient.id,
      },
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          primaryPhone: true,
          dateOfBirth: true,
        },
      },
    },
  })

  if (existingMember) {
    return {
      status: 'already_member',
      member: existingMember,
      list,
    }
  }

  const member = await prisma.patientListMember.create({
    data: {
      practiceId: params.practiceId,
      listId: params.listId,
      patientId: patient.id,
      source,
      matchedBy,
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          primaryPhone: true,
          dateOfBirth: true,
        },
      },
    },
  })

  const updatedList = await prisma.patientList.update({
    where: { id: params.listId },
    data: { memberCount: { increment: 1 } },
    select: { id: true, name: true, memberCount: true },
  })

  if (params.emitMemberAdded !== false) {
    await emitEvent({
      practiceId: params.practiceId,
      eventName: 'crm/list.member_added',
      entityType: 'patient_list_member',
      entityId: patient.id,
      data: {
        list: { id: list.id, name: list.name },
        patient: patientPayloadForEvent(patient),
      },
    })
  }

  return {
    status: 'added',
    member,
    list: updatedList,
  }
}
