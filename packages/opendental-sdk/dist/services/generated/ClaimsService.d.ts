import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Claims API */
export declare class ClaimsService extends BaseDomainService {
    protected readonly resourcePath = "claims";
    /** GET /claims */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /claims */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
    /** PUT /{id}/status */
    updateStatus(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id}/split */
    split(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=ClaimsService.d.ts.map