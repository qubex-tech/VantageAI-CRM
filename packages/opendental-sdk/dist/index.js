"use strict";
/**
 * @vantage/opendental-sdk — Multi-tenant Open Dental REST API integration
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.capabilityMatrix = exports.createSyncMetadata = exports.supportsIncrementalSync = exports.listSyncableResources = exports.getAllSyncCapabilities = exports.getSyncCapabilities = exports.watchSignalods = exports.filterByTimestampSince = exports.incrementalFetchSince = exports.fetchAllWithOffset = exports.paginatedFetchAll = exports.createServiceRegistry = exports.defaultLogger = exports.setLogger = exports.getLogger = exports.mapHttpStatusToError = exports.UnexpectedResponseError = exports.NetworkError = exports.TimeoutError = exports.RateLimitError = exports.ValidationError = exports.AuthorizationError = exports.AuthenticationError = exports.OpenDentalError = exports.toPracticeContext = exports.validateConnection = exports.checkConnectionHealth = exports.globalPracticeRegistry = exports.PracticeRegistry = exports.validateAuthentication = exports.TEST_CREDENTIALS = exports.createCredentials = exports.validateCredentials = exports.buildAuthorizationHeader = exports.resetRateLimitState = exports.enforceRateLimit = exports.withRetry = exports.normalizePaginationParams = exports.fetchAllPages = exports.normalizeBaseUrl = exports.buildUrl = exports.SERVICE_BASE_URL = exports.LOCAL_BASE_URL = exports.REMOTE_BASE_URL = exports.createClientFromContext = exports.OpenDentalClient = void 0;
// Client
var OpenDentalClient_1 = require("./client/OpenDentalClient");
Object.defineProperty(exports, "OpenDentalClient", { enumerable: true, get: function () { return OpenDentalClient_1.OpenDentalClient; } });
Object.defineProperty(exports, "createClientFromContext", { enumerable: true, get: function () { return OpenDentalClient_1.createClientFromContext; } });
var endpoints_1 = require("./client/endpoints");
Object.defineProperty(exports, "REMOTE_BASE_URL", { enumerable: true, get: function () { return endpoints_1.REMOTE_BASE_URL; } });
Object.defineProperty(exports, "LOCAL_BASE_URL", { enumerable: true, get: function () { return endpoints_1.LOCAL_BASE_URL; } });
Object.defineProperty(exports, "SERVICE_BASE_URL", { enumerable: true, get: function () { return endpoints_1.SERVICE_BASE_URL; } });
Object.defineProperty(exports, "buildUrl", { enumerable: true, get: function () { return endpoints_1.buildUrl; } });
Object.defineProperty(exports, "normalizeBaseUrl", { enumerable: true, get: function () { return endpoints_1.normalizeBaseUrl; } });
var pagination_1 = require("./client/pagination");
Object.defineProperty(exports, "fetchAllPages", { enumerable: true, get: function () { return pagination_1.fetchAllPages; } });
Object.defineProperty(exports, "normalizePaginationParams", { enumerable: true, get: function () { return pagination_1.normalizePaginationParams; } });
var retry_1 = require("./client/retry");
Object.defineProperty(exports, "withRetry", { enumerable: true, get: function () { return retry_1.withRetry; } });
Object.defineProperty(exports, "enforceRateLimit", { enumerable: true, get: function () { return retry_1.enforceRateLimit; } });
Object.defineProperty(exports, "resetRateLimitState", { enumerable: true, get: function () { return retry_1.resetRateLimitState; } });
// Auth
var authorization_1 = require("./auth/authorization");
Object.defineProperty(exports, "buildAuthorizationHeader", { enumerable: true, get: function () { return authorization_1.buildAuthorizationHeader; } });
Object.defineProperty(exports, "validateCredentials", { enumerable: true, get: function () { return authorization_1.validateCredentials; } });
var credentials_1 = require("./auth/credentials");
Object.defineProperty(exports, "createCredentials", { enumerable: true, get: function () { return credentials_1.createCredentials; } });
Object.defineProperty(exports, "TEST_CREDENTIALS", { enumerable: true, get: function () { return credentials_1.TEST_CREDENTIALS; } });
var validation_1 = require("./auth/validation");
Object.defineProperty(exports, "validateAuthentication", { enumerable: true, get: function () { return validation_1.validateAuthentication; } });
// Practice
var PracticeRegistry_1 = require("./practice/PracticeRegistry");
Object.defineProperty(exports, "PracticeRegistry", { enumerable: true, get: function () { return PracticeRegistry_1.PracticeRegistry; } });
Object.defineProperty(exports, "globalPracticeRegistry", { enumerable: true, get: function () { return PracticeRegistry_1.globalPracticeRegistry; } });
var connectionHealth_1 = require("./practice/connectionHealth");
Object.defineProperty(exports, "checkConnectionHealth", { enumerable: true, get: function () { return connectionHealth_1.checkConnectionHealth; } });
Object.defineProperty(exports, "validateConnection", { enumerable: true, get: function () { return connectionHealth_1.validateConnection; } });
var types_1 = require("./practice/types");
Object.defineProperty(exports, "toPracticeContext", { enumerable: true, get: function () { return types_1.toPracticeContext; } });
// Errors
var errors_1 = require("./errors");
Object.defineProperty(exports, "OpenDentalError", { enumerable: true, get: function () { return errors_1.OpenDentalError; } });
Object.defineProperty(exports, "AuthenticationError", { enumerable: true, get: function () { return errors_1.AuthenticationError; } });
Object.defineProperty(exports, "AuthorizationError", { enumerable: true, get: function () { return errors_1.AuthorizationError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return errors_1.ValidationError; } });
Object.defineProperty(exports, "RateLimitError", { enumerable: true, get: function () { return errors_1.RateLimitError; } });
Object.defineProperty(exports, "TimeoutError", { enumerable: true, get: function () { return errors_1.TimeoutError; } });
Object.defineProperty(exports, "NetworkError", { enumerable: true, get: function () { return errors_1.NetworkError; } });
Object.defineProperty(exports, "UnexpectedResponseError", { enumerable: true, get: function () { return errors_1.UnexpectedResponseError; } });
Object.defineProperty(exports, "mapHttpStatusToError", { enumerable: true, get: function () { return errors_1.mapHttpStatusToError; } });
// Logging
var logger_1 = require("./logging/logger");
Object.defineProperty(exports, "getLogger", { enumerable: true, get: function () { return logger_1.getLogger; } });
Object.defineProperty(exports, "setLogger", { enumerable: true, get: function () { return logger_1.setLogger; } });
Object.defineProperty(exports, "defaultLogger", { enumerable: true, get: function () { return logger_1.defaultLogger; } });
// Models
__exportStar(require("./models"), exports);
// Services
__exportStar(require("./services"), exports);
var ServiceRegistry_1 = require("./services/ServiceRegistry");
Object.defineProperty(exports, "createServiceRegistry", { enumerable: true, get: function () { return ServiceRegistry_1.createServiceRegistry; } });
// Sync
var paginatedFetchAll_1 = require("./sync/paginatedFetchAll");
Object.defineProperty(exports, "paginatedFetchAll", { enumerable: true, get: function () { return paginatedFetchAll_1.paginatedFetchAll; } });
Object.defineProperty(exports, "fetchAllWithOffset", { enumerable: true, get: function () { return paginatedFetchAll_1.fetchAllWithOffset; } });
var incrementalSync_1 = require("./sync/incrementalSync");
Object.defineProperty(exports, "incrementalFetchSince", { enumerable: true, get: function () { return incrementalSync_1.incrementalFetchSince; } });
Object.defineProperty(exports, "filterByTimestampSince", { enumerable: true, get: function () { return incrementalSync_1.filterByTimestampSince; } });
var signalodsWatcher_1 = require("./sync/signalodsWatcher");
Object.defineProperty(exports, "watchSignalods", { enumerable: true, get: function () { return signalodsWatcher_1.watchSignalods; } });
var syncMetadata_1 = require("./sync/syncMetadata");
Object.defineProperty(exports, "getSyncCapabilities", { enumerable: true, get: function () { return syncMetadata_1.getSyncCapabilities; } });
Object.defineProperty(exports, "getAllSyncCapabilities", { enumerable: true, get: function () { return syncMetadata_1.getAllSyncCapabilities; } });
Object.defineProperty(exports, "listSyncableResources", { enumerable: true, get: function () { return syncMetadata_1.listSyncableResources; } });
Object.defineProperty(exports, "supportsIncrementalSync", { enumerable: true, get: function () { return syncMetadata_1.supportsIncrementalSync; } });
Object.defineProperty(exports, "createSyncMetadata", { enumerable: true, get: function () { return syncMetadata_1.createSyncMetadata; } });
// Capability matrix
const capability_matrix_json_1 = __importDefault(require("./capability-matrix.json"));
exports.capabilityMatrix = capability_matrix_json_1.default;
//# sourceMappingURL=index.js.map