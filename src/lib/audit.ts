import { prisma } from './db'
import { redactPHIFromObject } from './phi'

export type AuditAction = 'create' | 'update' | 'delete' | 'view'
export type AuditResourceType = 
  | 'patient' 
  | 'appointment' 
  | 'insurance' 
  | 'cal_integration'
  | 'voice_conversation'
  | 'user'
  | 'workflow'
  | 'practice'

interface AuditLogParams {
  practiceId: string
  userId: string
  action: AuditAction
  resourceType: AuditResourceType
  resourceId: string
  changes?: {
    before?: any
    after?: any
  }
  ipAddress?: string
  userAgent?: string
}

/**
 * Create an audit log entry
 * Automatically redacts PHI from changes
 */
export async function createAuditLog(params: AuditLogParams) {
  const { changes, ...rest } = params
  
  // Redact PHI from changes before storing
  const redactedChanges = changes
    ? {
        before: changes.before ? redactPHIFromObject(changes.before) : undefined,
        after: changes.after ? redactPHIFromObject(changes.after) : undefined,
      }
    : undefined

  return prisma.auditLog.create({
    data: {
      ...rest,
      changes: redactedChanges ? (redactedChanges as any) : undefined,
    },
  })
}

/**
 * Log a patient timeline entry
 * @deprecated Use functions from @/lib/patient-activity instead for better type safety and automatic change detection
 */
export async function createTimelineEntry(params: {
  patientId: string
  type: 'appointment' | 'insurance' | 'call' | 'note' | 'email' | 'field_update' | 'document' | 'payment' | 'reminder' | 'task' | 'other'
  title: string
  description?: string
  metadata?: any
}) {
  return prisma.patientTimelineEntry.create({
    data: params,
  })
}

