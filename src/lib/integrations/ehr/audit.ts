import { prisma } from '@/lib/db'

export async function logEhrAudit(params: {
  tenantId: string
  actorUserId?: string | null
  action: string
  providerId: string
  entity: string
  entityId?: string | null
  metadata?: Record<string, unknown>
}) {
  const { tenantId, actorUserId, action, providerId, entity, entityId, metadata } = params
  return prisma.integrationAuditLog.create({
    data: {
      tenantId,
      actorUserId: actorUserId || undefined,
      action,
      entity,
      entityId: entityId || undefined,
      metadata: {
        providerId,
        ...metadata,
      },
    },
  })
}
