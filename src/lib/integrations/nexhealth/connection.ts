import { prisma } from '@/lib/db'
import type { NexHealthConnection } from '@prisma/client'
import type { NexhealthEnvironment } from './types'

export type NexhealthConnectionInput = {
  practiceId: string
  environment: NexhealthEnvironment
  subdomain: string
  institutionId?: number | null
  locationId: number
  locationName?: string | null
}

export async function getNexhealthConnection(practiceId: string): Promise<NexHealthConnection | null> {
  return prisma.nexHealthConnection.findUnique({ where: { practiceId } })
}

export async function requireNexhealthConnection(practiceId: string): Promise<NexHealthConnection> {
  const connection = await getNexhealthConnection(practiceId)
  if (!connection || !connection.isActive) {
    throw new Error('NexHealth is not connected for this practice')
  }
  return connection
}

export function asNexhealthEnvironment(value: string | null | undefined): NexhealthEnvironment {
  return value === 'production' ? 'production' : 'sandbox'
}

export async function saveNexhealthConnection(
  input: NexhealthConnectionInput
): Promise<NexHealthConnection> {
  const data = {
    environment: input.environment,
    subdomain: input.subdomain.trim(),
    institutionId: input.institutionId ?? null,
    locationId: input.locationId,
    locationName: input.locationName?.trim() || null,
    status: 'connected',
    isActive: true,
    lastSyncError: null,
  }
  return prisma.nexHealthConnection.upsert({
    where: { practiceId: input.practiceId },
    create: { practiceId: input.practiceId, ...data },
    update: data,
  })
}

export async function disconnectNexhealth(practiceId: string): Promise<void> {
  await prisma.nexHealthConnection.updateMany({
    where: { practiceId },
    data: { isActive: false, status: 'disconnected' },
  })
}

export async function recordNexhealthSyncResult(
  practiceId: string,
  result: {
    status: 'success' | 'partial' | 'error'
    error?: string | null
    completedAt?: Date
    readStatus?: string | null
    writeStatus?: string | null
  }
): Promise<void> {
  await prisma.nexHealthConnection.update({
    where: { practiceId },
    data: {
      lastSyncStatus: result.status,
      lastSyncError: result.error ?? null,
      ...(result.status === 'success' && result.completedAt
        ? { lastSuccessfulSyncAt: result.completedAt }
        : {}),
      ...(result.readStatus !== undefined ? { syncReadStatus: result.readStatus } : {}),
      ...(result.writeStatus !== undefined ? { syncWriteStatus: result.writeStatus } : {}),
      status: result.status === 'error' ? 'error' : 'connected',
    },
  })
}

export function publicNexhealthConnection(connection: NexHealthConnection | null) {
  if (!connection) return null
  return {
    id: connection.id,
    practiceId: connection.practiceId,
    environment: connection.environment,
    subdomain: connection.subdomain,
    institutionId: connection.institutionId,
    locationId: connection.locationId,
    locationName: connection.locationName,
    status: connection.status,
    isActive: connection.isActive,
    lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
    lastSyncStatus: connection.lastSyncStatus,
    lastSyncError: connection.lastSyncError,
    syncReadStatus: connection.syncReadStatus,
    syncWriteStatus: connection.syncWriteStatus,
  }
}

export function summarizeNexhealthSyncStatus(data: unknown): {
  readStatus: string | null
  writeStatus: string | null
} {
  const rows = Array.isArray(data) ? data : data && typeof data === 'object' ? [data] : []
  const first = rows[0]
  if (!first || typeof first !== 'object') {
    return { readStatus: null, writeStatus: null }
  }
  const record = first as Record<string, unknown>
  const read = record.read_status ?? (record.read as { status?: unknown } | undefined)?.status
  const write = record.write_status ?? (record.write as { status?: unknown } | undefined)?.status
  return {
    readStatus: typeof read === 'string' ? read : null,
    writeStatus: typeof write === 'string' ? write : null,
  }
}
