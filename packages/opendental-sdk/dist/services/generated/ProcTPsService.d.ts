import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental ProcTPs API */
export declare class ProcTPsService extends BaseDomainService {
    protected readonly resourcePath = "proctps";
    /** GET /proctps */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=ProcTPsService.d.ts.map