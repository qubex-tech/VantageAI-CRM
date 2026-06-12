import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental ApptFieldDefs API */
export declare class ApptFieldDefsService extends BaseDomainService {
    protected readonly resourcePath = "apptfielddefs";
    /** GET /apptfielddefs */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /apptfielddefs */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=ApptFieldDefsService.d.ts.map