export declare class OpenDentalError extends Error {
    readonly code: string;
    readonly status?: number;
    readonly details?: unknown;
    constructor(message: string, code?: string, status?: number, details?: unknown);
}
export declare class AuthenticationError extends OpenDentalError {
    constructor(message?: string, details?: unknown);
}
export declare class AuthorizationError extends OpenDentalError {
    constructor(message?: string, details?: unknown);
}
export declare class ValidationError extends OpenDentalError {
    constructor(message?: string, details?: unknown);
}
export declare class RateLimitError extends OpenDentalError {
    readonly retryAfterMs?: number;
    constructor(message?: string, retryAfterMs?: number, details?: unknown);
}
export declare class TimeoutError extends OpenDentalError {
    constructor(message?: string, details?: unknown);
}
export declare class NetworkError extends OpenDentalError {
    constructor(message?: string, details?: unknown);
}
export declare class UnexpectedResponseError extends OpenDentalError {
    constructor(message?: string, status?: number, details?: unknown);
}
export declare function mapHttpStatusToError(status: number, message: string, details?: unknown): OpenDentalError;
//# sourceMappingURL=index.d.ts.map