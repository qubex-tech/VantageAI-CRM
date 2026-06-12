"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkConnectionHealth = checkConnectionHealth;
exports.validateConnection = validateConnection;
async function checkConnectionHealth(client, context) {
    const started = Date.now();
    try {
        const preferences = await client.get('preferences', {
            params: { PrefName: 'ProgramVersion' },
        });
        const odVersion = preferences?.[0]?.ValueString ?? preferences?.[0]?.['ValueString'];
        return {
            status: 'healthy',
            checkedAt: new Date(),
            baseUrlUsed: client.getActiveBaseUrl(),
            latencyMs: Date.now() - started,
            odVersion: typeof odVersion === 'string' ? odVersion : undefined,
        };
    }
    catch (error) {
        return {
            status: 'unhealthy',
            checkedAt: new Date(),
            baseUrlUsed: client.getActiveBaseUrl(),
            latencyMs: Date.now() - started,
            error: error instanceof Error ? error.message : 'Connection check failed',
        };
    }
}
async function validateConnection(client) {
    try {
        await client.get('clinics');
        return { valid: true, message: 'Connection validated successfully' };
    }
    catch (error) {
        return {
            valid: false,
            message: error instanceof Error ? error.message : 'Connection validation failed',
        };
    }
}
//# sourceMappingURL=connectionHealth.js.map