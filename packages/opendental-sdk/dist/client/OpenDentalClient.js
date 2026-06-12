"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenDentalClient = void 0;
exports.createClientFromContext = createClientFromContext;
const authorization_1 = require("../auth/authorization");
const errors_1 = require("../errors");
const logger_1 = require("../logging/logger");
const endpoints_1 = require("./endpoints");
const retry_1 = require("./retry");
class OpenDentalClient {
    config;
    endpointChain;
    activeBaseUrl;
    constructor(config) {
        (0, authorization_1.validateCredentials)(config.credentials);
        this.config = {
            timeoutMs: 10000,
            maxRetries: 3,
            ...config,
        };
        this.endpointChain = (0, endpoints_1.resolveEndpointChain)(config.baseUrl, config.fallbackBaseUrls);
        this.activeBaseUrl = this.endpointChain[0];
    }
    getActiveBaseUrl() {
        return this.activeBaseUrl;
    }
    getPracticeId() {
        return this.config.practiceId;
    }
    async get(path, options = {}) {
        const response = await this.request('GET', path, options);
        return response.data;
    }
    async post(path, options = {}) {
        return this.request('POST', path, options);
    }
    async put(path, options = {}) {
        const response = await this.request('PUT', path, options);
        return response.data;
    }
    async delete(path, options = {}) {
        await this.request('DELETE', path, options);
    }
    async request(method, path, options = {}) {
        const logger = (0, logger_1.getLogger)();
        const pathParams = extractPathParams(path);
        const resolvedPath = pathParams ? (0, endpoints_1.interpolatePath)(path, pathParams.params) : path;
        const queryParams = { ...options.params, ...pathParams?.query };
        const execute = async (attempt) => {
            let lastNetworkError;
            for (const baseUrl of this.endpointChain) {
                const url = (0, endpoints_1.buildUrl)(baseUrl, resolvedPath, queryParams);
                const started = Date.now();
                try {
                    const response = await this.fetchWithTimeout(url, method, options);
                    this.activeBaseUrl = baseUrl;
                    logger.info('Open Dental API request completed', {
                        practiceId: this.config.practiceId,
                        connectionId: this.config.connectionId,
                        method,
                        path: resolvedPath,
                        status: response.status,
                        durationMs: Date.now() - started,
                        attempt,
                    });
                    if (!response.ok) {
                        const errorBody = await safeReadText(response);
                        if (response.status === 429) {
                            throw new errors_1.RateLimitError(errorBody || 'Rate limit exceeded', (0, retry_1.parseRetryAfterMs)(response.headers), { status: response.status, body: errorBody });
                        }
                        throw (0, errors_1.mapHttpStatusToError)(response.status, errorBody || `Open Dental API error: ${response.status}`, { status: response.status, body: errorBody });
                    }
                    const data = await parseResponseBody(response, method);
                    return {
                        data,
                        status: response.status,
                        headers: response.headers,
                        location: response.headers.get('location') ?? undefined,
                    };
                }
                catch (error) {
                    if (error instanceof errors_1.RateLimitError || (error instanceof Error && 'status' in error && !isNetworkError(error))) {
                        throw error;
                    }
                    lastNetworkError = error;
                    logger.warn('Open Dental endpoint attempt failed, trying fallback', {
                        practiceId: this.config.practiceId,
                        baseUrl,
                        method,
                        path: resolvedPath,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
            throw lastNetworkError instanceof Error
                ? new errors_1.NetworkError(lastNetworkError.message, lastNetworkError)
                : new errors_1.NetworkError('All endpoint attempts failed');
        };
        if (options.skipRetry) {
            return execute(0);
        }
        return (0, retry_1.withRetry)(execute, {
            maxRetries: this.config.maxRetries,
            baseDelayMs: 500,
            maxDelayMs: 15000,
            permissionTier: this.config.permissionTier,
        });
    }
    async fetchWithTimeout(url, method, options) {
        const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, {
                method,
                headers: {
                    Authorization: (0, authorization_1.buildAuthorizationHeader)(this.config.credentials),
                    Accept: 'application/json',
                    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                },
                body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
                signal: controller.signal,
            });
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new errors_1.TimeoutError(`Request timed out after ${timeoutMs}ms`);
            }
            throw new errors_1.NetworkError(error instanceof Error ? error.message : 'Network request failed', error);
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
exports.OpenDentalClient = OpenDentalClient;
function isNetworkError(error) {
    return error instanceof errors_1.NetworkError || error instanceof errors_1.TimeoutError;
}
async function safeReadText(response) {
    try {
        return await response.text();
    }
    catch {
        return '';
    }
}
async function parseResponseBody(response, method) {
    if (method === 'DELETE' || response.status === 204) {
        return undefined;
    }
    const text = await response.text();
    if (!text) {
        return undefined;
    }
    try {
        return JSON.parse(text);
    }
    catch {
        throw new errors_1.UnexpectedResponseError('Failed to parse JSON response', response.status, { body: text.slice(0, 200) });
    }
}
function extractPathParams(path) {
    if (!path.includes('{'))
        return null;
    return null;
}
function createClientFromContext(context, developerKey) {
    return new OpenDentalClient({
        credentials: {
            developerKey: developerKey ?? context.credentials.developerKey,
            customerKey: context.credentials.customerKey,
        },
        baseUrl: context.baseUrl,
        fallbackBaseUrls: context.fallbackBaseUrls,
        apiMode: context.apiMode,
        practiceId: context.practiceId,
        connectionId: context.connectionId,
    });
}
//# sourceMappingURL=OpenDentalClient.js.map