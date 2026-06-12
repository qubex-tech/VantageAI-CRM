import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental FeeScheds API */
export declare class FeeSchedsService extends BaseDomainService {
    protected readonly resourcePath = "feescheds";
    /** GET /feescheds */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /feescheds */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=FeeSchedsService.d.ts.map