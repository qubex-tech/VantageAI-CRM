import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental TaskNotes API */
export declare class TaskNotesService extends BaseDomainService {
    protected readonly resourcePath = "tasknotes";
    /** GET /tasknotes */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /tasknotes */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=TaskNotesService.d.ts.map