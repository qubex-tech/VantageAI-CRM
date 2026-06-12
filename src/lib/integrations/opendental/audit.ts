import { logEhrAudit } from '@/lib/integrations/ehr/audit'

export async function logOpenDentalAudit(params: {
  tenantId: string
  actorUserId?: string | null
  action: string
  entity: string
  entityId?: string | null
  metadata?: Record<string, unknown>
}) {
  return logEhrAudit({
    ...params,
    providerId: 'opendental',
  })
}
