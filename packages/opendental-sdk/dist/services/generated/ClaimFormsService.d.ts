import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental ClaimForms API */
export declare class ClaimFormsService extends BaseDomainService {
    protected readonly resourcePath = "claimforms";
    /** GET /claimforms */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
}
//# sourceMappingURL=ClaimFormsService.d.ts.map