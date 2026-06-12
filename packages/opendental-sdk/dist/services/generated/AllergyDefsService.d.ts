import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental AllergyDefs API */
export declare class AllergyDefsService extends BaseDomainService {
    protected readonly resourcePath = "allergydefs";
    /** GET /allergydefs */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /allergydefs */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=AllergyDefsService.d.ts.map