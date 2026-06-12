import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Guardians API */
export declare class GuardiansService extends BaseDomainService {
    protected readonly resourcePath = "guardians";
    /** GET /guardians */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /guardians */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=GuardiansService.d.ts.map