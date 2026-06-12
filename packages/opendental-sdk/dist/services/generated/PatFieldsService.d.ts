import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental PatFields API */
export declare class PatFieldsService extends BaseDomainService {
    protected readonly resourcePath = "patfields";
    /** GET /patfields */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=PatFieldsService.d.ts.map