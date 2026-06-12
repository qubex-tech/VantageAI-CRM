import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental InsPlans API */
export declare class InsPlansService extends BaseDomainService {
    protected readonly resourcePath = "insplans";
    /** GET /insplans */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /insplans */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=InsPlansService.d.ts.map