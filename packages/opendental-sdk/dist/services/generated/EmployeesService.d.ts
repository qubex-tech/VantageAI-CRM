import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Employees API */
export declare class EmployeesService extends BaseDomainService {
    protected readonly resourcePath = "employees";
    /** GET /employees */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /employees */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=EmployeesService.d.ts.map