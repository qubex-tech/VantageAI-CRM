import {
  checkConnectionHealth,
  validateConnection,
  type OpenDentalClient,
} from '@vantage/opendental-sdk'
import {
  getOpenDentalClient,
  loadPracticeContext,
  updateConnectionSyncMetadata,
} from './factory'
import { logOpenDentalAudit } from './audit'

export async function validatePracticeConnection(practiceId: string, actorUserId?: string) {
  const context = await loadPracticeContext(practiceId)
  const client = await getOpenDentalClient(practiceId)
  const validation = await validateConnection(client)
  const health = await checkConnectionHealth(client, context)

  await updateConnectionSyncMetadata(practiceId, {
    lastHealthCheckAt: health.checkedAt,
    status: validation.valid ? 'connected' : 'error',
    odVersion: health.odVersion,
    lastSyncError: validation.valid ? null : validation.message,
  })

  await logOpenDentalAudit({
    tenantId: practiceId,
    actorUserId,
    action: validation.valid ? 'connection.validated' : 'connection.validation_failed',
    entity: 'OpenDentalConnection',
    entityId: context.connectionId,
    metadata: {
      status: health.status,
      latencyMs: health.latencyMs,
      baseUrlUsed: health.baseUrlUsed,
    },
  })

  return { validation, health }
}

export async function probeConnectionHealth(practiceId: string) {
  const context = await loadPracticeContext(practiceId)
  const client = await getOpenDentalClient(practiceId)
  return checkConnectionHealth(client, context)
}

export async function registerAndValidateConnection(params: {
  practiceId: string
  displayName: string
  customerKey: string
  apiMode?: string
  baseUrl?: string
  fallbackBaseUrls?: string[]
  actorUserId?: string
}) {
  const { upsertOpenDentalConnection } = await import('./factory')
  const connection = await upsertOpenDentalConnection(params)
  const result = await validatePracticeConnection(params.practiceId, params.actorUserId)
  return { connection, ...result }
}

export async function refreshConnectionMetadata(practiceId: string, client: OpenDentalClient) {
  const health = await probeConnectionHealth(practiceId)
  await updateConnectionSyncMetadata(practiceId, {
    lastHealthCheckAt: health.checkedAt,
    odVersion: health.odVersion,
    status: health.status === 'healthy' ? 'connected' : 'degraded',
  })
  return health
}

export async function recordSyncResult(
  practiceId: string,
  result: { status: 'success' | 'error'; error?: string; recordsProcessed?: number }
) {
  await updateConnectionSyncMetadata(practiceId, {
    lastSuccessfulSyncAt: result.status === 'success' ? new Date() : undefined,
    lastSyncStatus: result.status,
    lastSyncError: result.error ?? null,
  })
}
