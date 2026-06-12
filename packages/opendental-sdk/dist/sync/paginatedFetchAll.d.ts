import type { PaginationParams } from '../models/common';
export type ListFetcher<T> = (params: PaginationParams) => Promise<T[]>;
export declare function paginatedFetchAll<T>(fetchPage: ListFetcher<T>, options?: {
    limit?: number;
    maxPages?: number;
    enterprise?: boolean;
}): Promise<T[]>;
export declare function fetchAllWithOffset<T>(listFn: (params: Record<string, string | number | boolean | undefined | null>) => Promise<T[]>, baseParams?: Record<string, string | number | boolean | undefined | null>, options?: {
    limit?: number;
    maxPages?: number;
}): Promise<T[]>;
//# sourceMappingURL=paginatedFetchAll.d.ts.map