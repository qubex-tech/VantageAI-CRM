/** Open Dental boolean fields are string "true" or "false" */
export type OdBoolean = 'true' | 'false';
/** yyyy-MM-dd */
export type OdDate = string;
/** yyyy-MM-dd HH:mm:ss (24hr) */
export type OdDateTime = string;
export type PaginationParams = {
    Limit?: number;
    Offset?: number;
};
export declare const DEFAULT_PAGE_LIMIT = 100;
export declare const MAX_PAGE_LIMIT = 100;
export declare const ENTERPRISE_MAX_PAGE_LIMIT = 1000;
export type ApiMode = 'remote' | 'service' | 'local';
export type PermissionTier = 'ReadAll' | 'AllOthers' | 'Comm' | 'Documents' | 'Queries' | 'Appointments' | 'InsuranceSimple' | 'Insurance' | 'Patients' | 'Payments' | 'PayPlans' | 'ProcedureLogs' | 'Setup' | 'TextingASAP' | 'Enterprise';
export type OpenDentalCredentials = {
    developerKey: string;
    customerKey: string;
};
export type ClientConfig = {
    credentials: OpenDentalCredentials;
    baseUrl: string;
    fallbackBaseUrls?: string[];
    apiMode?: ApiMode;
    timeoutMs?: number;
    maxRetries?: number;
    permissionTier?: PermissionTier;
    practiceId?: string;
    connectionId?: string;
};
export type RequestOptions = {
    params?: Record<string, string | number | boolean | undefined | null>;
    body?: unknown;
    timeoutMs?: number;
    skipRetry?: boolean;
};
export type ApiResponse<T> = {
    data: T;
    status: number;
    headers: Headers;
    location?: string;
};
//# sourceMappingURL=common.d.ts.map