import { prisma } from '@/lib/db'
import { isOpenAriaSessionStatus } from '@/lib/pebble-webhook'

/**
 * Bind the clinician's open Aria session so their Index ring dictation appends to it.
 * No-op when this provider has no active Pebble credential for the practice.
 */
export async function bindPebbleActiveSession(params: {
  practiceId: string
  providerUserId: string
  sessionId: string
}): Promise<void> {
  const integration = await prisma.pebbleIntegration.findUnique({
    where: {
      practiceId_providerUserId: {
        practiceId: params.practiceId,
        providerUserId: params.providerUserId,
      },
    },
    select: { id: true, isActive: true },
  })
  if (!integration?.isActive) return

  await prisma.pebbleIntegration.update({
    where: { id: integration.id },
    data: { activeSessionId: params.sessionId },
  })
}

/**
 * Clear sticky active session when the visit ends / is discarded.
 */
export async function clearPebbleActiveSession(params: {
  practiceId: string
  sessionId: string
}): Promise<void> {
  await prisma.pebbleIntegration.updateMany({
    where: {
      practiceId: params.practiceId,
      activeSessionId: params.sessionId,
    },
    data: { activeSessionId: null },
  })
}

/**
 * Resolve which Aria session should receive an Index ring dictation
 * for a specific practice + provider credential.
 */
export async function resolvePebbleAriaSession(params: {
  practiceId: string
  providerUserId: string
  activeSessionId: string | null
}): Promise<{ id: string; status: string } | null> {
  if (params.activeSessionId) {
    const sticky = await prisma.scribeSession.findFirst({
      where: {
        id: params.activeSessionId,
        practiceId: params.practiceId,
        providerUserId: params.providerUserId,
        status: { notIn: ['signed', 'discarded'] },
      },
      select: { id: true, status: true },
    })
    if (sticky && isOpenAriaSessionStatus(sticky.status)) {
      return sticky
    }
  }

  return prisma.scribeSession.findFirst({
    where: {
      practiceId: params.practiceId,
      providerUserId: params.providerUserId,
      status: {
        in: ['recording', 'uploading', 'ready_for_review', 'failed'],
      },
    },
    orderBy: { startedAt: 'desc' },
    select: { id: true, status: true },
  })
}
