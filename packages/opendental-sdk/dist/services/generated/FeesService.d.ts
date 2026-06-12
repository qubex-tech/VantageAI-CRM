import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Fees API */
export declare class FeesService extends BaseDomainService {
    protected readonly resourcePath = "fees";
    /** GET /fees */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /fees */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=FeesService.d.ts.map