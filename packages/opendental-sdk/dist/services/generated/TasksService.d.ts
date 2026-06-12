import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Tasks API */
export declare class TasksService extends BaseDomainService {
    protected readonly resourcePath = "tasks";
    /** GET /tasks */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /tasks */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=TasksService.d.ts.map