/**
 * @vantage/opendental-sdk — Multi-tenant Open Dental REST API integration
 */
export { OpenDentalClient, createClientFromContext } from './client/OpenDentalClient';
export { REMOTE_BASE_URL, LOCAL_BASE_URL, SERVICE_BASE_URL, buildUrl, normalizeBaseUrl } from './client/endpoints';
export { fetchAllPages, normalizePaginationParams } from './client/pagination';
export { withRetry, enforceRateLimit, resetRateLimitState } from './client/retry';
export { buildAuthorizationHeader, validateCredentials } from './auth/authorization';
export { createCredentials, TEST_CREDENTIALS } from './auth/credentials';
export { validateAuthentication } from './auth/validation';
export { PracticeRegistry, globalPracticeRegistry } from './practice/PracticeRegistry';
export { checkConnectionHealth, validateConnection } from './practice/connectionHealth';
export type { PracticeContext, OpenDentalPracticeConfig } from './practice/types';
export { toPracticeContext } from './practice/types';
export { OpenDentalError, AuthenticationError, AuthorizationError, ValidationError, RateLimitError, TimeoutError, NetworkError, UnexpectedResponseError, mapHttpStatusToError, } from './errors';
export { getLogger, setLogger, defaultLogger } from './logging/logger';
export type { Logger, LogContext } from './logging/logger';
export * from './models';
export * from './services';
export { createServiceRegistry, type OpenDentalServices } from './services/ServiceRegistry';
export { paginatedFetchAll, fetchAllWithOffset } from './sync/paginatedFetchAll';
export { incrementalFetchSince, filterByTimestampSince } from './sync/incrementalSync';
export { watchSignalods } from './sync/signalodsWatcher';
export { getSyncCapabilities, getAllSyncCapabilities, listSyncableResources, supportsIncrementalSync, createSyncMetadata, } from './sync/syncMetadata';
export type { SyncCapability, SyncCapabilitiesMap, SyncMetadata } from './sync/syncMetadata';
import capabilityMatrix from './capability-matrix.json';
export { capabilityMatrix };
export type CapabilityMatrix = typeof capabilityMatrix;
//# sourceMappingURL=index.d.ts.map