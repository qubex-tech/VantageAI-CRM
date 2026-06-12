import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental ApptFields API */
export declare class ApptFieldsService extends BaseDomainService {
    protected readonly resourcePath = "apptfields";
    /** GET /apptfields */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /apptfields */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=ApptFieldsService.d.ts.map