import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental CovSpans API */
export declare class CovSpansService extends BaseDomainService {
    protected readonly resourcePath = "covspans";
    /** GET /covspans */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /covspans */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=CovSpansService.d.ts.map