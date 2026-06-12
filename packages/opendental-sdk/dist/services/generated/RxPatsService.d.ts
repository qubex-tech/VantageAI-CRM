import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental RxPats API */
export declare class RxPatsService extends BaseDomainService {
    protected readonly resourcePath = "rxpats";
    /** GET /rxpats */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
}
//# sourceMappingURL=RxPatsService.d.ts.map