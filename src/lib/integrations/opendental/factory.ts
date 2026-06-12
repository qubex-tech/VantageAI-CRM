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
import { getDefaultBaseUrl, getDeveloperKey } from './server'

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

export async function loadPracticeContext(practiceId: string): Promise<PracticeContext> {
  const connection = await getOpenDentalConnection(practiceId)
  if (!connection || !connection.isActive) {
    throw new Error('Open Dental integration not configured for this practice')
  }
  const developerKey = getDeveloperKey()
  const context = toPracticeContext(connectionToPracticeConfig(connection, developerKey))
  registry.register(context)
  return context
}

export async function getOpenDentalClient(practiceId: string): Promise<OpenDentalClient> {
  const context = await loadPracticeContext(practiceId)
  return createClientFromContext(context, getDeveloperKey())
}

export async function getOpenDentalServices(practiceId: string) {
  const context = await loadPracticeContext(practiceId)
  const client = createClientFromContext(context, getDeveloperKey())
  return createServiceRegistry(client, context)
}

export function getPracticeRegistry(): PracticeRegistry {
  return registry
}

export async function upsertOpenDentalConnection(params: {
  practiceId: string
  displayName: string
  customerKey?: string
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

  return prisma.openDentalConnection.upsert({
    where: { practiceId: params.practiceId },
    create: {
      practiceId: params.practiceId,
      displayName: params.displayName,
      customerKeyEncrypted: encrypted,
      apiMode: params.apiMode ?? 'remote',
      baseUrl: params.baseUrl ?? getDefaultBaseUrl(),
      fallbackBaseUrls: params.fallbackBaseUrls ?? [],
      status: 'pending',
    },
    update: {
      displayName: params.displayName,
      ...(params.customerKey ? { customerKeyEncrypted: encrypted } : {}),
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
  }
}
