import type { OpenDentalClient } from '../../client/OpenDentalClient';
import type { ApiResponse, PaginationParams, RequestOptions } from '../../models/common';
import type { PracticeContext } from '../../practice/types';
export declare abstract class BaseDomainService {
    protected readonly client: OpenDentalClient;
    protected readonly context: PracticeContext;
    protected abstract readonly resourcePath: string;
    constructor(client: OpenDentalClient, context: PracticeContext);
    getPracticeId(): string;
    protected buildPath(suffix?: string): string;
    protected getList<T>(params?: Record<string, string | number | boolean | undefined | null>): Promise<T[]>;
    protected getSingle<T>(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<T>;
    protected getSubResource<T>(subPath: string, params?: Record<string, string | number | boolean | undefined | null>): Promise<T>;
    protected createRecord<T>(body: unknown, subPath?: string): Promise<ApiResponse<T>>;
    protected updateRecord<T = void>(id: string | number, body: unknown): Promise<T>;
    protected updateSubResource<T = void>(subPath: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T>;
    protected removeRecord(id: string | number): Promise<void>;
    protected removeSubResource(subPath: string): Promise<void>;
    protected postAction<T>(subPath: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>>;
    listPaginated<T>(params?: PaginationParams & Record<string, string | number | boolean | undefined>): Promise<T[]>;
}
//# sourceMappingURL=BaseDomainService.d.ts.map