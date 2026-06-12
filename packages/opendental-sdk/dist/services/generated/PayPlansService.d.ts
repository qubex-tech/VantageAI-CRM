import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental PayPlans API */
export declare class PayPlansService extends BaseDomainService {
    protected readonly resourcePath = "payplans";
    /** GET /payplans */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /payplans */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** POST /dynamic */
    createDynamic(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id}/dynamic */
    updateDynamic(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=PayPlansService.d.ts.map