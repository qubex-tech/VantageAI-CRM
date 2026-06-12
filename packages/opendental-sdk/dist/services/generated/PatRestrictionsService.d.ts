import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental PatRestrictions API */
export declare class PatRestrictionsService extends BaseDomainService {
    protected readonly resourcePath = "patrestrictions";
    /** GET /patrestrictions */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /patrestrictions */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=PatRestrictionsService.d.ts.map