import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Allergies API */
export declare class AllergiesService extends BaseDomainService {
    protected readonly resourcePath = "allergies";
    /** GET /allergies */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /allergies */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=AllergiesService.d.ts.map