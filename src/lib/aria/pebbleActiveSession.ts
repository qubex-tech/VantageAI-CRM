import { prisma } from '@/lib/db'
import { isOpenAriaSessionStatus } from '@/lib/pebble-webhook'

/**
 * Bind the clinician's open Aria session so Index ring dictation appends to it.
 * No-op when the practice has no active Pebble integration for this provider.
 */
export async function bindPebbleActiveSession(params: {
  practiceId: string
  providerUserId: string
  sessionId: string
}): Promise<void> {
  const integration = await prisma.pebbleIntegration.findFirst({
    where: {
      practiceId: params.practiceId,
      isActive: true,
      OR: [{ providerUserId: params.providerUserId }, { providerUserId: null }],
    },
    select: { id: true, providerUserId: true },
  })
  if (!integration) return

  // Only bind when this provider owns the integration (or provider not yet set).
  if (integration.providerUserId && integration.providerUserId !== params.providerUserId) {
    return
  }

  await prisma.pebbleIntegration.update({
    where: { id: integration.id },
    data: {
      activeSessionId: params.sessionId,
      ...(integration.providerUserId ? {} : { providerUserId: params.providerUserId }),
    },
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
 * Resolve which Aria session should receive an Index ring dictation.
 */
export async function resolvePebbleAriaSession(params: {
  practiceId: string
  providerUserId: string | null
  activeSessionId: string | null
}): Promise<{ id: string; status: string } | null> {
  if (params.activeSessionId) {
    const sticky = await prisma.scribeSession.findFirst({
      where: {
        id: params.activeSessionId,
        practiceId: params.practiceId,
        status: { notIn: ['signed', 'discarded'] },
      },
      select: { id: true, status: true },
    })
    if (sticky && isOpenAriaSessionStatus(sticky.status)) {
      return sticky
    }
    // Stale binding — fall through to newest open session
  }

  if (!params.providerUserId) return null

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
