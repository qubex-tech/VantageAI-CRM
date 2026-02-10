"use strict";
/**
 * Audit every MCP tool call: who, when, purpose, patient_id, policy_id, tool_name, fields returned (paths only).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeMcpAuditLog = writeMcpAuditLog;
exports.collectFieldPaths = collectFieldPaths;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function writeMcpAuditLog(params) {
    try {
        await prisma.mcpAccessAuditLog.create({
            data: {
                requestId: params.requestId,
                actorId: params.actorId,
                actorType: params.actorType,
                purpose: params.purpose,
                patientId: params.patientId,
                policyId: params.policyId,
                toolName: params.toolName,
                fieldsReturnedJson: params.fieldsReturned,
            },
        });
    }
    catch (err) {
        console.error('[MCP Audit] Failed to write audit log:', err);
        // Do not throw; audit failure should not break the request
    }
}
/**
 * Collect field paths from an output object (for audit). Returns paths like "patient.first_name", "insurance.member_id_masked".
 */
function collectFieldPaths(obj, prefix = '') {
    const paths = [];
    if (obj == null)
        return paths;
    if (Array.isArray(obj)) {
        obj.forEach((item, i) => {
            paths.push(...collectFieldPaths(item, `${prefix}[${i}]`));
        });
        return paths;
    }
    if (typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
            const path = prefix ? `${prefix}.${key}` : key;
            if (value != null && typeof value === 'object' && !(value instanceof Date)) {
                paths.push(...collectFieldPaths(value, path));
            }
            else {
                paths.push(path);
            }
        }
    }
    return paths;
}
//# sourceMappingURL=audit.js.map