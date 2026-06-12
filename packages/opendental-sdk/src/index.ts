/**
 * @vantage/opendental-sdk — Multi-tenant Open Dental REST API integration
 */

// Client
export { OpenDentalClient, createClientFromContext } from './client/OpenDentalClient'
export { REMOTE_BASE_URL, LOCAL_BASE_URL, SERVICE_BASE_URL, buildUrl, normalizeBaseUrl } from './client/endpoints'
export { fetchAllPages, normalizePaginationParams } from './client/pagination'
export { withRetry, enforceRateLimit, resetRateLimitState } from './client/retry'

// Auth
export { buildAuthorizationHeader, validateCredentials } from './auth/authorization'
export { createCredentials, TEST_CREDENTIALS } from './auth/credentials'
export { validateAuthentication } from './auth/validation'

// Practice
export { PracticeRegistry, globalPracticeRegistry } from './practice/PracticeRegistry'
export { checkConnectionHealth, validateConnection } from './practice/connectionHealth'
export type { PracticeContext, OpenDentalPracticeConfig } from './practice/types'
export { toPracticeContext } from './practice/types'

// Errors
export {
  OpenDentalError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  RateLimitError,
  TimeoutError,
  NetworkError,
  UnexpectedResponseError,
  mapHttpStatusToError,
} from './errors'

// Logging
export { getLogger, setLogger, defaultLogger } from './logging/logger'
export type { Logger, LogContext } from './logging/logger'

// Models
export * from './models'

// Services
export * from './services'
export { createServiceRegistry, type OpenDentalServices } from './services/ServiceRegistry'

// Sync
export { paginatedFetchAll, fetchAllWithOffset } from './sync/paginatedFetchAll'
export { incrementalFetchSince, filterByTimestampSince } from './sync/incrementalSync'
export { watchSignalods } from './sync/signalodsWatcher'
export {
  getSyncCapabilities,
  getAllSyncCapabilities,
  listSyncableResources,
  supportsIncrementalSync,
  createSyncMetadata,
} from './sync/syncMetadata'
export type { SyncCapability, SyncCapabilitiesMap, SyncMetadata } from './sync/syncMetadata'

// Capability matrix
import capabilityMatrix from './capability-matrix.json'
export { capabilityMatrix }
export type CapabilityMatrix = typeof capabilityMatrix
