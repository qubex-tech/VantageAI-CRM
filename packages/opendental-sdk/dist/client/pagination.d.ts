import type { PaginationParams } from '../models/common';
export declare function normalizePaginationParams(params?: PaginationParams, enterprise?: boolean): PaginationParams;
export type PaginatedFetcher<T> = (params: PaginationParams) => Promise<T[]>;
export declare function fetchAllPages<T>(fetchPage: PaginatedFetcher<T>, options?: {
    limit?: number;
    maxPages?: number;
    enterprise?: boolean;
}): Promise<T[]>;
//# sourceMappingURL=pagination.d.ts.map