"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnexpectedResponseError = exports.NetworkError = exports.TimeoutError = exports.RateLimitError = exports.ValidationError = exports.AuthorizationError = exports.AuthenticationError = exports.OpenDentalError = void 0;
exports.mapHttpStatusToError = mapHttpStatusToError;
class OpenDentalError extends Error {
    code;
    status;
    details;
    constructor(message, code = 'OPEN_DENTAL_ERROR', status, details) {
        super(message);
        this.name = 'OpenDentalError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}
exports.OpenDentalError = OpenDentalError;
class AuthenticationError extends OpenDentalError {
    constructor(message = 'Authentication failed', details) {
        super(message, 'AUTHENTICATION_ERROR', 401, details);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends OpenDentalError {
    constructor(message = 'Authorization failed', details) {
        super(message, 'AUTHORIZATION_ERROR', 403, details);
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
class ValidationError extends OpenDentalError {
    constructor(message = 'Validation failed', details) {
        super(message, 'VALIDATION_ERROR', 400, details);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class RateLimitError extends OpenDentalError {
    retryAfterMs;
    constructor(message = 'Rate limit exceeded', retryAfterMs, details) {
        super(message, 'RATE_LIMIT_ERROR', 429, details);
        this.name = 'RateLimitError';
        this.retryAfterMs = retryAfterMs;
    }
}
exports.RateLimitError = RateLimitError;
class TimeoutError extends OpenDentalError {
    constructor(message = 'Request timed out', details) {
        super(message, 'TIMEOUT_ERROR', 408, details);
        this.name = 'TimeoutError';
    }
}
exports.TimeoutError = TimeoutError;
class NetworkError extends OpenDentalError {
    constructor(message = 'Network failure', details) {
        super(message, 'NETWORK_ERROR', undefined, details);
        this.name = 'NetworkError';
    }
}
exports.NetworkError = NetworkError;
class UnexpectedResponseError extends OpenDentalError {
    constructor(message = 'Unexpected API response', status, details) {
        super(message, 'UNEXPECTED_RESPONSE', status, details);
        this.name = 'UnexpectedResponseError';
    }
}
exports.UnexpectedResponseError = UnexpectedResponseError;
function mapHttpStatusToError(status, message, details) {
    if (status === 401)
        return new AuthenticationError(message, details);
    if (status === 403)
        return new AuthorizationError(message, details);
    if (status === 400)
        return new ValidationError(message, details);
    if (status === 429)
        return new RateLimitError(message, undefined, details);
    if (status === 408)
        return new TimeoutError(message, details);
    if (status >= 500)
        return new OpenDentalError(message, 'API_FAILURE', status, details);
    return new OpenDentalError(message, 'API_FAILURE', status, details);
}
//# sourceMappingURL=index.js.map