import type { OdDateTime } from '../models/common';
export type IncrementalListParams = {
    since: OdDateTime | string;
    dateField?: string;
    additionalParams?: Record<string, string | number | boolean | undefined | null>;
};
export declare function incrementalFetchSince<T extends Record<string, unknown>>(listFn: (params: Record<string, string | number | boolean | undefined | null>) => Promise<T[]>, options: IncrementalListParams): Promise<T[]>;
export declare function filterByTimestampSince<T extends Record<string, unknown>>(items: T[], since: string, field?: string): T[];
//# sourceMappingURL=incrementalSync.d.ts.map