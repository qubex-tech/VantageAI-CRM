import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental CovCats API */
export declare class CovCatsService extends BaseDomainService {
    protected readonly resourcePath = "covcats";
    /** GET /covcats */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /covcats */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=CovCatsService.d.ts.map