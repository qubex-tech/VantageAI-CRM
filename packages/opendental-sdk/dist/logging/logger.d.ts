export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = {
    practiceId?: string;
    connectionId?: string;
    method?: string;
    path?: string;
    status?: number;
    durationMs?: number;
    attempt?: number;
    event?: string;
    [key: string]: unknown;
};
export type Logger = {
    debug: (message: string, context?: LogContext) => void;
    info: (message: string, context?: LogContext) => void;
    warn: (message: string, context?: LogContext) => void;
    error: (message: string, context?: LogContext) => void;
};
export declare const defaultLogger: Logger;
export declare function setLogger(logger: Logger): void;
export declare function getLogger(): Logger;
//# sourceMappingURL=logger.d.ts.map