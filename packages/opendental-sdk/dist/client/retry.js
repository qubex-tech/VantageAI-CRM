"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMinIntervalMs = getMinIntervalMs;
exports.enforceRateLimit = enforceRateLimit;
exports.sleep = sleep;
exports.computeBackoffDelay = computeBackoffDelay;
exports.isRetryableStatus = isRetryableStatus;
exports.parseRetryAfterMs = parseRetryAfterMs;
exports.withRetry = withRetry;
exports.resetRateLimitState = resetRateLimitState;
const errors_1 = require("../errors");
const TIER_MIN_INTERVAL_MS = {
    ReadAll: 5000,
    Enterprise: 500,
    Comm: 1000,
    Documents: 1000,
    Queries: 1000,
    Appointments: 1000,
    InsuranceSimple: 1000,
    Insurance: 1000,
    Patients: 1000,
    Payments: 1000,
    PayPlans: 1000,
    ProcedureLogs: 1000,
    Setup: 1000,
    TextingASAP: 1000,
    AllOthers: 1000,
};
let lastRequestAt = 0;
function getMinIntervalMs(tier) {
    if (!tier)
        return 1000;
    return TIER_MIN_INTERVAL_MS[tier] ?? 1000;
}
async function enforceRateLimit(tier) {
    const minInterval = getMinIntervalMs(tier);
    const now = Date.now();
    const elapsed = now - lastRequestAt;
    if (elapsed < minInterval) {
        await sleep(minInterval - elapsed);
    }
    lastRequestAt = Date.now();
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function computeBackoffDelay(attempt, baseDelayMs, maxDelayMs) {
    const delay = baseDelayMs * Math.pow(2, attempt);
    return Math.min(delay, maxDelayMs);
}
function isRetryableStatus(status) {
    return status === 408 || status === 429 || status >= 500;
}
function parseRetryAfterMs(headers) {
    const retryAfter = headers.get('retry-after');
    if (!retryAfter)
        return undefined;
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds))
        return seconds * 1000;
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date))
        return Math.max(0, date - Date.now());
    return undefined;
}
async function withRetry(fn, config) {
    let lastError;
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            await enforceRateLimit(config.permissionTier);
            return await fn(attempt);
        }
        catch (error) {
            lastError = error;
            if (error instanceof errors_1.RateLimitError) {
                const delay = error.retryAfterMs ?? computeBackoffDelay(attempt, config.baseDelayMs, config.maxDelayMs);
                await sleep(delay);
                continue;
            }
            if (attempt >= config.maxRetries)
                break;
            if (error instanceof Error && 'status' in error) {
                const status = error.status;
                if (status && !isRetryableStatus(status))
                    break;
            }
            await sleep(computeBackoffDelay(attempt, config.baseDelayMs, config.maxDelayMs));
        }
    }
    throw lastError;
}
function resetRateLimitState() {
    lastRequestAt = 0;
}
//# sourceMappingURL=retry.js.map