import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental SubstitutionLinks API */
export declare class SubstitutionLinksService extends BaseDomainService {
    protected readonly resourcePath = "substitutionlinks";
    /** GET /substitutionlinks */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /substitutionlinks */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=SubstitutionLinksService.d.ts.map