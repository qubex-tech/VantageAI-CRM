import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental DiscountPlanSubs API */
export declare class DiscountPlanSubsService extends BaseDomainService {
    protected readonly resourcePath = "discountplansubs";
    /** GET /discountplansubs */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /discountplansubs */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=DiscountPlanSubsService.d.ts.map