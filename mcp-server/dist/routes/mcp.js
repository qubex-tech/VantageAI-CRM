"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const registry_js_1 = require("../tools/registry.js");
const router = (0, express_1.Router)();
router.get('/health', (_req, res) => {
    res.json({ ok: true });
});
router.get('/tools', (_req, res) => {
    const tools = registry_js_1.TOOL_DEFINITIONS.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
        output_schema: t.output_schema,
    }));
    res.json({ tools });
});
router.post('/call', async (req, res) => {
    const mcp = res.locals.mcp;
    if (!mcp) {
        res.status(401).json({ output: {}, error: { code: 'UNAUTHORIZED', message: 'Missing auth context' } });
        return;
    }
    const body = req.body;
    const toolName = body?.tool;
    const input = body?.input ?? {};
    if (!toolName || typeof toolName !== 'string') {
        res.status(400).json({
            output: {},
            error: { code: 'BAD_REQUEST', message: 'Missing or invalid "tool" in body' },
        });
        return;
    }
    const start = Date.now();
    const ctx = {
        requestId: mcp.requestId,
        actorId: mcp.actorId,
        actorType: mcp.actorType,
        purpose: mcp.purpose,
        allowUnmasked: mcp.allowUnmasked,
    };
    const result = await (0, registry_js_1.invokeTool)(toolName, input, ctx);
    const latency = Date.now() - start;
    if (result.error) {
        res.status(400).json({
            output: result.output,
            error: result.error,
            meta: { request_id: mcp.requestId, latency_ms: latency },
        });
        return;
    }
    res.json({
        output: result.output,
        meta: { request_id: mcp.requestId, latency_ms: latency },
    });
});
exports.default = router;
//# sourceMappingURL=mcp.js.map