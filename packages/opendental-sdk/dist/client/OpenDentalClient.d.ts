import type { ApiResponse, ClientConfig, RequestOptions } from '../models/common';
export declare class OpenDentalClient {
    private readonly config;
    private readonly endpointChain;
    private activeBaseUrl;
    constructor(config: ClientConfig);
    getActiveBaseUrl(): string;
    getPracticeId(): string | undefined;
    get<T>(path: string, options?: RequestOptions): Promise<T>;
    post<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>;
    put<T>(path: string, options?: RequestOptions): Promise<T>;
    delete(path: string, options?: RequestOptions): Promise<void>;
    request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, options?: RequestOptions): Promise<ApiResponse<T>>;
    private fetchWithTimeout;
}
export declare function createClientFromContext(context: import('../practice/types').PracticeContext, developerKey?: string): OpenDentalClient;
//# sourceMappingURL=OpenDentalClient.d.ts.map