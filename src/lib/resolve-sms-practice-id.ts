import { prisma } from '@/lib/db'
import { isVantageAdmin } from '@/lib/permissions'

type AuthUser = {
  id: string
  email: string
  name?: string | null
  practiceId: string | null
  role: string
}

export async function resolveSmsPracticeId(
  user: AuthUser,
  options?: {
    patientId?: string | null
    conversationId?: string | null
    queryPracticeId?: string | null
  }
): Promise<string | null> {
  const normalizedUser = {
    ...user,
    name: user.name ?? null,
  }

  if (options?.queryPracticeId && isVantageAdmin(normalizedUser)) {
    return options.queryPracticeId
  }

  if (options?.conversationId) {
    const conversation = await prisma.communicationConversation.findFirst({
      where: { id: options.conversationId },
      select: { practiceId: true },
    })
    if (conversation?.practiceId) {
      if (
        isVantageAdmin(normalizedUser) ||
        conversation.practiceId === user.practiceId
      ) {
        return conversation.practiceId
      }
    }
  }

  if (options?.patientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: options.patientId, deletedAt: null },
      select: { practiceId: true },
    })
    if (patient?.practiceId) {
      if (isVantageAdmin(normalizedUser) || patient.practiceId === user.practiceId) {
        return patient.practiceId
      }
    }
  }

  return user.practiceId
}
