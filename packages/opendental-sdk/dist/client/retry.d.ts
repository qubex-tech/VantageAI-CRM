import type { PermissionTier } from '../models/common';
export type RetryConfig = {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    permissionTier?: PermissionTier;
};
export declare function getMinIntervalMs(tier?: PermissionTier): number;
export declare function enforceRateLimit(tier?: PermissionTier): Promise<void>;
export declare function sleep(ms: number): Promise<void>;
export declare function computeBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number;
export declare function isRetryableStatus(status: number): boolean;
export declare function parseRetryAfterMs(headers: Headers): number | undefined;
export declare function withRetry<T>(fn: (attempt: number) => Promise<T>, config: RetryConfig): Promise<T>;
export declare function resetRateLimitState(): void;
//# sourceMappingURL=retry.d.ts.map