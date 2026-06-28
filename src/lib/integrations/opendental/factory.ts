import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import {
  OpenDentalClient,
  PracticeRegistry,
  createClientFromContext,
  createServiceRegistry,
  toPracticeContext,
  type OpenDentalPracticeConfig,
  type PracticeContext,
} from '@vantage/opendental-sdk'
import { getDefaultBaseUrl } from './server'

const registry = new PracticeRegistry()

export async function getOpenDentalConnection(practiceId: string) {
  return prisma.openDentalConnection.findUnique({
    where: { practiceId },
  })
}

export function connectionToPracticeConfig(
  connection: {
    id: string
    practiceId: string
    displayName: string
    customerKeyEncrypted: string
    apiMode: string
    baseUrl: string
    fallbackBaseUrls: unknown
    enabledPermissions: unknown
  },
  developerKey: string
): OpenDentalPracticeConfig {
  const fallbackBaseUrls = Array.isArray(connection.fallbackBaseUrls)
    ? (connection.fallbackBaseUrls as string[])
    : undefined
  const enabledPermissions = Array.isArray(connection.enabledPermissions)
    ? (connection.enabledPermissions as string[])
    : undefined

  return {
    practiceId: connection.practiceId,
    connectionId: connection.id,
    displayName: connection.displayName,
    customerKey: decryptString(connection.customerKeyEncrypted),
    developerKey,
    apiMode: connection.apiMode as 'remote' | 'service' | 'local',
    baseUrl: connection.baseUrl,
    fallbackBaseUrls,
    enabledPermissions,
  }
}

/**
 * Resolve the developer key for a connection: prefer the per-connection encrypted
 * key, falling back to the OPEN_DENTAL_DEVELOPER_KEY env var (so existing
 * connections and the sandbox keep working).
 */
function resolveDeveloperKey(connection: { developerKeyEncrypted: string | null }): string {
  if (connection.developerKeyEncrypted) {
    const perConnection = decryptString(connection.developerKeyEncrypted).trim()
    if (perConnection) return perConnection
  }
  const envKey = process.env.OPEN_DENTAL_DEVELOPER_KEY?.trim()
  if (envKey) return envKey
  throw new Error(
    'No Open Dental developer key configured (set one on the connection or OPEN_DENTAL_DEVELOPER_KEY)'
  )
}

async function loadConnectionContext(
  practiceId: string
): Promise<{ context: PracticeContext; developerKey: string }> {
  const connection = await getOpenDentalConnection(practiceId)
  if (!connection || !connection.isActive) {
    throw new Error('Open Dental integration not configured for this practice')
  }
  const developerKey = resolveDeveloperKey(connection)
  const context = toPracticeContext(connectionToPracticeConfig(connection, developerKey))
  registry.register(context)
  return { context, developerKey }
}

export async function loadPracticeContext(practiceId: string): Promise<PracticeContext> {
  const { context } = await loadConnectionContext(practiceId)
  return context
}

export async function getOpenDentalClient(practiceId: string): Promise<OpenDentalClient> {
  const { context, developerKey } = await loadConnectionContext(practiceId)
  return createClientFromContext(context, developerKey)
}

export async function getOpenDentalServices(practiceId: string) {
  const { context, developerKey } = await loadConnectionContext(practiceId)
  const client = createClientFromContext(context, developerKey)
  return createServiceRegistry(client, context)
}

export function getPracticeRegistry(): PracticeRegistry {
  return registry
}

export async function upsertOpenDentalConnection(params: {
  practiceId: string
  displayName: string
  customerKey?: string
  developerKey?: string
  apiMode?: string
  baseUrl?: string
  fallbackBaseUrls?: string[]
}) {
  const existing = await getOpenDentalConnection(params.practiceId)
  const encrypted = params.customerKey
    ? encryptString(params.customerKey)
    : existing?.customerKeyEncrypted

  if (!encrypted) {
    throw new Error('customerKey is required for new Open Dental connections')
  }

  const developerKeyEncrypted = params.developerKey
    ? encryptString(params.developerKey)
    : undefined

  return prisma.openDentalConnection.upsert({
    where: { practiceId: params.practiceId },
    create: {
      practiceId: params.practiceId,
      displayName: params.displayName,
      customerKeyEncrypted: encrypted,
      developerKeyEncrypted: developerKeyEncrypted ?? null,
      apiMode: params.apiMode ?? 'remote',
      baseUrl: params.baseUrl ?? getDefaultBaseUrl(),
      fallbackBaseUrls: params.fallbackBaseUrls ?? [],
      status: 'pending',
    },
    update: {
      displayName: params.displayName,
      ...(params.customerKey ? { customerKeyEncrypted: encrypted } : {}),
      ...(developerKeyEncrypted ? { developerKeyEncrypted } : {}),
      apiMode: params.apiMode ?? existing?.apiMode ?? 'remote',
      baseUrl: params.baseUrl ?? existing?.baseUrl ?? getDefaultBaseUrl(),
      fallbackBaseUrls: params.fallbackBaseUrls ?? existing?.fallbackBaseUrls ?? [],
      isActive: true,
    },
  })
}

export async function disableOpenDentalConnection(practiceId: string) {
  return prisma.openDentalConnection.update({
    where: { practiceId },
    data: {
      isActive: false,
      status: 'disabled',
    },
  })
}

export async function updateConnectionSyncMetadata(
  practiceId: string,
  data: {
    lastSuccessfulSyncAt?: Date
    lastSyncStatus?: string
    lastSyncError?: string | null
    lastHealthCheckAt?: Date
    status?: string
    odVersion?: string
  }
) {
  return prisma.openDentalConnection.update({
    where: { practiceId },
    data,
  })
}

export function sanitizeConnectionForResponse(connection: {
  id: string
  practiceId: string
  displayName: string
  apiMode: string
  baseUrl: string
  fallbackBaseUrls: unknown
  status: string
  lastHealthCheckAt: Date | null
  lastSuccessfulSyncAt: Date | null
  lastSyncStatus: string | null
  lastSyncError: string | null
  odVersion: string | null
  enabledPermissions: unknown
  capabilityMetadata: unknown
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  developerKeyEncrypted?: string | null
}) {
  return {
    id: connection.id,
    practiceId: connection.practiceId,
    displayName: connection.displayName,
    apiMode: connection.apiMode,
    baseUrl: connection.baseUrl,
    fallbackBaseUrls: connection.fallbackBaseUrls,
    status: connection.status,
    lastHealthCheckAt: connection.lastHealthCheckAt,
    lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
    lastSyncStatus: connection.lastSyncStatus,
    lastSyncError: connection.lastSyncError,
    odVersion: connection.odVersion,
    enabledPermissions: connection.enabledPermissions,
    capabilityMetadata: connection.capabilityMetadata,
    isActive: connection.isActive,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
    hasCustomerKey: true,
    hasDeveloperKey: !!connection.developerKeyEncrypted,
  }
}
