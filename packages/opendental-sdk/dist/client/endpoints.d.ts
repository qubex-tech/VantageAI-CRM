export declare const REMOTE_BASE_URL = "https://api.opendental.com/api/v1";
export declare const LOCAL_BASE_URL = "http://localhost:30222/api/v1";
export declare const SERVICE_BASE_URL = "http://localhost:30223/api/v1";
export declare function normalizeBaseUrl(url: string): string;
export declare function resolveEndpointChain(baseUrl: string, fallbackBaseUrls?: string[]): string[];
export declare function buildUrl(baseUrl: string, path: string, params?: Record<string, string | number | boolean | undefined | null>): string;
export declare function interpolatePath(path: string, params: Record<string, string | number>): string;
//# sourceMappingURL=endpoints.d.ts.map