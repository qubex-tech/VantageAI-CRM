"use strict";
/**
 * PHI minimization: mask sensitive values (member_id, group_number) by default.
 * Show last 4 only unless unmask is explicitly authorized.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskLast4 = maskLast4;
exports.maskZip = maskZip;
function maskLast4(value) {
    if (value == null || value === '')
        return '—';
    const s = String(value).trim();
    if (s.length <= 4)
        return '****';
    return `****${s.slice(-4)}`;
}
function maskZip(value) {
    if (value == null || value === '')
        return '—';
    const s = String(value).trim();
    if (s.length <= 4)
        return '****';
    return `****${s.slice(-4)}`;
}
//# sourceMappingURL=masking.js.map