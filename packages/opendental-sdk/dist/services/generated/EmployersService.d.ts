import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Employers API */
export declare class EmployersService extends BaseDomainService {
    protected readonly resourcePath = "employers";
    /** GET /employers */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /employers */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=EmployersService.d.ts.map