import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental PerioMeasures API */
export declare class PerioMeasuresService extends BaseDomainService {
    protected readonly resourcePath = "periomeasures";
    /** GET /periomeasures */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /periomeasures */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=PerioMeasuresService.d.ts.map