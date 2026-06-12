import matrix from '../capability-matrix.json'

export type SyncCapability = {
  uniqueId: string
  search: boolean
  create: boolean
  update: boolean
  delete: boolean
  bulkRead: boolean
  incrementalRead: boolean
  lastModifiedField: string | null
  operations: string[]
}

export type SyncCapabilitiesMap = Record<string, SyncCapability>

const capabilities = matrix.syncCapabilities as SyncCapabilitiesMap

export function getSyncCapabilities(resource: string): SyncCapability | undefined {
  return capabilities[resource]
}

export function getAllSyncCapabilities(): SyncCapabilitiesMap {
  return { ...capabilities }
}

export function listSyncableResources(): string[] {
  return Object.entries(capabilities)
    .filter(([, cap]) => cap.bulkRead || cap.incrementalRead)
    .map(([resource]) => resource)
}

export function supportsIncrementalSync(resource: string): boolean {
  return capabilities[resource]?.incrementalRead ?? false
}

export type SyncMetadata = {
  resource: string
  lastSyncAt?: Date
  status: 'idle' | 'running' | 'success' | 'error'
  error?: string
  recordsProcessed?: number
}

export function createSyncMetadata(resource: string): SyncMetadata {
  return { resource, status: 'idle' }
}
