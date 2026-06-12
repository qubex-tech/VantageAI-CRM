import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Benefits API */
export declare class BenefitsService extends BaseDomainService {
    protected readonly resourcePath = "benefits";
    /** GET /benefits */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /benefits */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=BenefitsService.d.ts.map