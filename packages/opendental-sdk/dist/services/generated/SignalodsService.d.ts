import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Signalods API */
export declare class SignalodsService extends BaseDomainService {
    protected readonly resourcePath = "signalods";
    /** GET /signalods */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
}
//# sourceMappingURL=SignalodsService.d.ts.map