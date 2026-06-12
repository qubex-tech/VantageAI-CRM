import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Queries API */
export declare class QueriesService extends BaseDomainService {
    protected readonly resourcePath = "queries";
    /** POST /queries */
    post(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /shortquery */
    shortQuery(body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=QueriesService.d.ts.map