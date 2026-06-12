import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental DiscountPlans API */
export declare class DiscountPlansService extends BaseDomainService {
    protected readonly resourcePath = "discountplans";
    /** GET /discountplans */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /discountplans */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=DiscountPlansService.d.ts.map