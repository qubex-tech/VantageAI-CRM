import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental PatPlans API */
export declare class PatPlansService extends BaseDomainService {
    protected readonly resourcePath = "patplans";
    /** GET /patplans */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /patplans */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=PatPlansService.d.ts.map