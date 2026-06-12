import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Commlogs API */
export declare class CommlogsService extends BaseDomainService {
    protected readonly resourcePath = "commlogs";
    /** GET /commlogs */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /commlogs */
    create(body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=CommlogsService.d.ts.map