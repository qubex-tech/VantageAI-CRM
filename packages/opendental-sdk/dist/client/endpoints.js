"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVICE_BASE_URL = exports.LOCAL_BASE_URL = exports.REMOTE_BASE_URL = void 0;
exports.normalizeBaseUrl = normalizeBaseUrl;
exports.resolveEndpointChain = resolveEndpointChain;
exports.buildUrl = buildUrl;
exports.interpolatePath = interpolatePath;
exports.REMOTE_BASE_URL = 'https://api.opendental.com/api/v1';
exports.LOCAL_BASE_URL = 'http://localhost:30222/api/v1';
exports.SERVICE_BASE_URL = 'http://localhost:30223/api/v1';
function normalizeBaseUrl(url) {
    return url.replace(/\/+$/g, '');
}
function resolveEndpointChain(baseUrl, fallbackBaseUrls = []) {
    const chain = [normalizeBaseUrl(baseUrl), ...fallbackBaseUrls.map(normalizeBaseUrl)];
    return [...new Set(chain.filter(Boolean))];
}
function buildUrl(baseUrl, path, params) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${normalizeBaseUrl(baseUrl)}${normalizedPath}`);
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        }
    }
    return url.toString();
}
function interpolatePath(path, params) {
    return path.replace(/\{(\w+)\}/g, (_, key) => {
        const value = params[key];
        if (value === undefined || value === null) {
            throw new Error(`Missing path parameter: ${key}`);
        }
        return encodeURIComponent(String(value));
    });
}
//# sourceMappingURL=endpoints.js.map