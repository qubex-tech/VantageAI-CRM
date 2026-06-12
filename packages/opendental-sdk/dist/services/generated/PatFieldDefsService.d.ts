import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental PatFieldDefs API */
export declare class PatFieldDefsService extends BaseDomainService {
    protected readonly resourcePath = "patfielddefs";
    /** GET /patfielddefs */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /patfielddefs */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=PatFieldDefsService.d.ts.map