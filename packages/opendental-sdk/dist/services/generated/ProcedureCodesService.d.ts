import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental ProcedureCodes API */
export declare class ProcedureCodesService extends BaseDomainService {
    protected readonly resourcePath = "procedurecodes";
    /** GET /procedurecodes */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /procedurecodes */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=ProcedureCodesService.d.ts.map