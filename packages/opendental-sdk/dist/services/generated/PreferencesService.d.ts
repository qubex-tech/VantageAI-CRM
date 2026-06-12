import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Preferences API */
export declare class PreferencesService extends BaseDomainService {
    protected readonly resourcePath = "preferences";
    /** GET /preferences */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
}
//# sourceMappingURL=PreferencesService.d.ts.map