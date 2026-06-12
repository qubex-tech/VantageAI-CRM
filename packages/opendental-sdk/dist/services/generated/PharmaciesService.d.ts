import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Pharmacies API */
export declare class PharmaciesService extends BaseDomainService {
    protected readonly resourcePath = "pharmacies";
    /** GET /pharmacies */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
}
//# sourceMappingURL=PharmaciesService.d.ts.map