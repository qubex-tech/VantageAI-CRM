import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental LabCases API */
export declare class LabCasesService extends BaseDomainService {
    protected readonly resourcePath = "labcases";
    /** GET /labcases */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /labcases */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=LabCasesService.d.ts.map