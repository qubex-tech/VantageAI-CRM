import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Deposits API */
export declare class DepositsService extends BaseDomainService {
    protected readonly resourcePath = "deposits";
    /** GET /deposits */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /deposits */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=DepositsService.d.ts.map