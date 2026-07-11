import { prisma } from '@/lib/db'
import { emitEvent } from '@/lib/outbox'

export type RunListAutomationsResult = {
  listId: string
  listName: string
  emitted: number
  memberCount: number
}

/**
 * Fan out crm/list.run events for each member of a patient list.
 * Existing AutomationRule runners pick these up via the outbox.
 */
export async function runListAutomations(params: {
  practiceId: string
  listId: string
}): Promise<RunListAutomationsResult> {
  const list = await prisma.patientList.findFirst({
    where: { id: params.listId, practiceId: params.practiceId },
    select: { id: true, name: true },
  })
  if (!list) {
    throw new Error('List not found')
  }

  const members = await prisma.patientListMember.findMany({
    where: {
      listId: list.id,
      practiceId: params.practiceId,
      patient: { deletedAt: null },
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
    orderBy: { createdAt: 'asc' },
  })

  let emitted = 0
  for (const member of members) {
    const patient = member.patient
    await emitEvent({
      practiceId: params.practiceId,
      eventName: 'crm/list.run',
      entityType: 'patient_list',
      entityId: list.id,
      data: {
        list: { id: list.id, name: list.name },
        patient: {
          id: patient.id,
          name: patient.name,
          firstName: patient.firstName,
          lastName: patient.lastName,
          email: patient.email,
          phone: patient.primaryPhone || patient.phone,
          primaryPhone: patient.primaryPhone,
          dateOfBirth: patient.dateOfBirth?.toISOString() ?? null,
        },
      },
    })
    emitted++
  }

  return {
    listId: list.id,
    listName: list.name,
    emitted,
    memberCount: members.length,
  }
}
