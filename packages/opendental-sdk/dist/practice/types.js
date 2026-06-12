"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPracticeContext = toPracticeContext;
function toPracticeContext(config) {
    return {
        practiceId: config.practiceId,
        connectionId: config.connectionId,
        displayName: config.displayName,
        credentials: {
            developerKey: config.developerKey,
            customerKey: config.customerKey,
        },
        baseUrl: config.baseUrl ?? 'https://api.opendental.com/api/v1',
        fallbackBaseUrls: config.fallbackBaseUrls,
        apiMode: config.apiMode ?? 'remote',
        enabledPermissions: config.enabledPermissions,
    };
}
//# sourceMappingURL=types.js.map