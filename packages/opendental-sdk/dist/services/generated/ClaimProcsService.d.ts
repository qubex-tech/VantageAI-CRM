import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental ClaimProcs API */
export declare class ClaimProcsService extends BaseDomainService {
    protected readonly resourcePath = "claimprocs";
    /** GET /claimprocs */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /insadjust */
    createInsAdjust(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /insadjust */
    updateInsAdjust(body: Record<string, unknown>): Promise<unknown>;
    /** POST /supplemental */
    createSupplemental(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=ClaimProcsService.d.ts.map