"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const mcp_js_1 = __importDefault(require("./routes/mcp.js"));
const auth_js_1 = require("./middleware/auth.js");
const PORT = Number(process.env.PORT) || 4010;
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: '256kb' }));
app.get('/mcp/health', (_req, res) => {
    res.json({ ok: true });
});
app.use('/mcp', auth_js_1.requireMcpAuth, mcp_js_1.default);
app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
});
app.listen(PORT, () => {
    console.log(`MCP Verification Server listening on port ${PORT}`);
});
//# sourceMappingURL=index.js.map