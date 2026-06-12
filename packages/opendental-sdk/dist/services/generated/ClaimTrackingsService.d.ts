import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental ClaimTrackings API */
export declare class ClaimTrackingsService extends BaseDomainService {
    protected readonly resourcePath = "claimtrackings";
    /** GET /claimtrackings */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /claimtrackings */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=ClaimTrackingsService.d.ts.map