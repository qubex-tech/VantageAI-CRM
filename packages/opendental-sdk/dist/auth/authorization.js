"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAuthorizationHeader = buildAuthorizationHeader;
exports.validateCredentials = validateCredentials;
function buildAuthorizationHeader(credentials) {
    const { developerKey, customerKey } = credentials;
    if (!developerKey?.trim() || !customerKey?.trim()) {
        throw new Error('Developer key and customer key are required');
    }
    return `ODFHIR ${developerKey.trim()}/${customerKey.trim()}`;
}
function validateCredentials(credentials) {
    if (!credentials.developerKey?.trim()) {
        throw new Error('Developer key is required');
    }
    if (!credentials.customerKey?.trim()) {
        throw new Error('Customer key is required');
    }
}
//# sourceMappingURL=authorization.js.map