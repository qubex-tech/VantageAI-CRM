"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireMcpAuth = requireMcpAuth;
const MCP_API_KEYS = (process.env.MCP_API_KEYS ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
const ALLOW_AGENT_UNMASKED = process.env.ALLOW_AGENT_UNMASKED === 'true';
const REQUIRED_PURPOSE = 'insurance_verification';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function requireMcpAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || !MCP_API_KEYS.includes(apiKey)) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } });
        return;
    }
    const actorId = req.headers['x-actor-id'];
    const actorType = req.headers['x-actor-type'];
    const purpose = req.headers['x-purpose'];
    const requestId = req.headers['x-request-id'];
    const allowUnmaskedHeader = req.headers['x-allow-unmasked'] === 'true';
    if (!actorId?.trim()) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing X-Actor-Id' } });
        return;
    }
    if (!actorType || !['agent', 'user', 'system'].includes(actorType)) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'X-Actor-Type must be agent, user, or system' } });
        return;
    }
    if (purpose !== REQUIRED_PURPOSE) {
        res.status(400).json({
            error: {
                code: 'BAD_REQUEST',
                message: `X-Purpose must be "${REQUIRED_PURPOSE}"`,
            },
        });
        return;
    }
    if (!requestId || !UUID_REGEX.test(requestId)) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'X-Request-Id must be a valid UUID' } });
        return;
    }
    const allowUnmasked = allowUnmaskedHeader &&
        (actorType !== 'agent' || ALLOW_AGENT_UNMASKED);
    res.locals.mcp = {
        actorId: actorId.trim(),
        actorType,
        purpose,
        requestId,
        allowUnmasked,
    };
    next();
}
//# sourceMappingURL=auth.js.map