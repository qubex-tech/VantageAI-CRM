"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultLogger = void 0;
exports.setLogger = setLogger;
exports.getLogger = getLogger;
const PHI_SENSITIVE_RESOURCES = new Set([
    'patients',
    'patientnotes',
    'commlogs',
    'documents',
    'payments',
    'claims',
    'procedures',
    'procedurelogs',
    'accountmodules',
]);
function isPhiPath(path) {
    if (!path)
        return false;
    const segment = path.split('/').filter(Boolean)[0]?.toLowerCase();
    return segment ? PHI_SENSITIVE_RESOURCES.has(segment) : false;
}
function formatLog(level, message, context) {
    const payload = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...context,
    };
    return JSON.stringify(payload);
}
exports.defaultLogger = {
    debug(message, context) {
        if (process.env.OPEN_DENTAL_DEBUG === '1') {
            console.debug(formatLog('debug', message, sanitizeContext(context)));
        }
    },
    info(message, context) {
        console.log(formatLog('info', message, sanitizeContext(context)));
    },
    warn(message, context) {
        console.warn(formatLog('warn', message, sanitizeContext(context)));
    },
    error(message, context) {
        console.error(formatLog('error', message, sanitizeContext(context)));
    },
};
function sanitizeContext(context) {
    if (!context)
        return context;
    const sanitized = { ...context };
    if (isPhiPath(context.path)) {
        delete sanitized.body;
        delete sanitized.responseBody;
    }
    return sanitized;
}
let activeLogger = exports.defaultLogger;
function setLogger(logger) {
    activeLogger = logger;
}
function getLogger() {
    return activeLogger;
}
//# sourceMappingURL=logger.js.map