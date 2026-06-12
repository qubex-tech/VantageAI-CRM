import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental QuickPasteCats API */
export declare class QuickPasteCatsService extends BaseDomainService {
    protected readonly resourcePath = "quickpastecats";
    /** GET /quickpastecats */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
}
//# sourceMappingURL=QuickPasteCatsService.d.ts.map