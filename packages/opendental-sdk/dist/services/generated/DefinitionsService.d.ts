import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Definitions API */
export declare class DefinitionsService extends BaseDomainService {
    protected readonly resourcePath = "definitions";
    /** GET /definitions */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /definitions */
    create(body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=DefinitionsService.d.ts.map