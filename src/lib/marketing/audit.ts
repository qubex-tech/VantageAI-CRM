// Marketing audit logging utilities

import { prisma } from '../db'
import { redactPHIFromObject } from '../phi'

export type MarketingAuditAction =
  | 'TEMPLATE_CREATED'
  | 'TEMPLATE_UPDATED'
  | 'TEMPLATE_PUBLISHED'
  | 'TEMPLATE_ARCHIVED'
  | 'TEMPLATE_DUPLICATED'
  | 'BRAND_UPDATED'
  | 'SENDERS_UPDATED'
  | 'TEST_SENT'
  | 'ASSET_UPLOADED'

export type MarketingEntityType = 'Template' | 'BrandProfile' | 'Senders' | 'Asset'

interface MarketingAuditLogParams {
  tenantId: string
  actorUserId: string | null
  actorType: 'staff' | 'agent' | 'system'
  action: MarketingAuditAction
  entityType: MarketingEntityType
  entityId: string
  metadata?: any
}

/**
 * Create a marketing audit log entry
 * Automatically redacts PHI from metadata
 */
export async function createMarketingAuditLog(params: MarketingAuditLogParams) {
  const { metadata, ...rest } = params
  
  // Redact PHI from metadata before storing
  const redactedMetadata = metadata ? redactPHIFromObject(metadata) : undefined
  
  return prisma.marketingAuditLog.create({
    data: {
      ...rest,
      metadata: redactedMetadata as any,
    },
  })
}
