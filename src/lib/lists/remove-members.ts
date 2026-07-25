import { prisma } from '@/lib/db'

export type RemoveListMembersResult = {
  removedCount: number
  remainingCount: number
  removedTagCount: number
}

/**
 * Remove one or more patients from a list. Clears the list-name tag when the
 * patient is not on another list with the same name. Does not delete CRM patients.
 */
export async function removePatientsFromList(params: {
  practiceId: string
  listId: string
  patientIds: string[]
}): Promise<RemoveListMembersResult> {
  const uniquePatientIds = [...new Set(params.patientIds.filter(Boolean))]
  if (uniquePatientIds.length === 0) {
    throw new Error('At least one patientId is required')
  }

  const list = await prisma.patientList.findFirst({
    where: { id: params.listId, practiceId: params.practiceId },
    select: { id: true, name: true },
  })
  if (!list) {
    throw new Error('List not found')
  }

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.patientListMember.deleteMany({
      where: {
        listId: params.listId,
        practiceId: params.practiceId,
        patientId: { in: uniquePatientIds },
      },
    })

    const remaining = await tx.patientListMember.count({
      where: {
        listId: params.listId,
        practiceId: params.practiceId,
      },
    })

    await tx.patientList.update({
      where: { id: params.listId },
      data: { memberCount: remaining },
    })

    let removedTags = 0
    if (deleted.count > 0) {
      const patientsStillOnSameNamedList = await tx.patientListMember.findMany({
        where: {
          practiceId: params.practiceId,
          patientId: { in: uniquePatientIds },
          list: { name: list.name },
        },
        select: { patientId: true },
        distinct: ['patientId'],
      })
      const keepTagPatientIds = new Set(patientsStillOnSameNamedList.map((p) => p.patientId))
      const removeTagPatientIds = uniquePatientIds.filter((patientId) => !keepTagPatientIds.has(patientId))
      if (removeTagPatientIds.length > 0) {
        const tagDeleteResult = await tx.patientTag.deleteMany({
          where: {
            patientId: { in: removeTagPatientIds },
            tag: list.name,
          },
        })
        removedTags = tagDeleteResult.count
      }
    }

    return {
      removedCount: deleted.count,
      remainingCount: remaining,
      removedTagCount: removedTags,
    }
  })
}
