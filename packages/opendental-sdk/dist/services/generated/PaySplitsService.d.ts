import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental PaySplits API */
export declare class PaySplitsService extends BaseDomainService {
    protected readonly resourcePath = "paysplits";
    /** GET /paysplits */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=PaySplitsService.d.ts.map