import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Adjustments API */
export declare class AdjustmentsService extends BaseDomainService {
    protected readonly resourcePath = "adjustments";
    /** GET /adjustments */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /adjustments */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=AdjustmentsService.d.ts.map