import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Payments API */
export declare class PaymentsService extends BaseDomainService {
    protected readonly resourcePath = "payments";
    /** GET /payments */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /payments */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** POST /refund */
    createRefund(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id}/partial */
    updatePartial(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=PaymentsService.d.ts.map