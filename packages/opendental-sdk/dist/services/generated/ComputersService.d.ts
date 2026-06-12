import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Computers API */
export declare class ComputersService extends BaseDomainService {
    protected readonly resourcePath = "computers";
    /** GET /computers */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
}
//# sourceMappingURL=ComputersService.d.ts.map