import { prisma } from '@/lib/db'

interface AuditInput {
  practiceId: string
  userId: string
  action: string
  resourceType: string
  resourceId: string
  metadata?: Record<string, unknown>
}

export async function recordCommunicationAudit({
  practiceId,
  userId,
  action,
  resourceType,
  resourceId,
  metadata,
}: AuditInput) {
  return prisma.auditLog.create({
    data: {
      practiceId,
      userId,
      action,
      resourceType,
      resourceId,
      changes: metadata ?? undefined,
    },
  })
}
