import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental ClaimPayments API */
export declare class ClaimPaymentsService extends BaseDomainService {
    protected readonly resourcePath = "claimpayments";
    /** GET /claimpayments */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /claimpayments */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** POST /batch */
    createBatch(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=ClaimPaymentsService.d.ts.map