import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Userods API */
export declare class UserodsService extends BaseDomainService {
    protected readonly resourcePath = "userods";
    /** GET /userods */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /userods */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=UserodsService.d.ts.map