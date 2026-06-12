import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Laboratories API */
export declare class LaboratoriesService extends BaseDomainService {
    protected readonly resourcePath = "laboratories";
    /** GET /laboratories */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /laboratories */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=LaboratoriesService.d.ts.map