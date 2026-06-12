import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental AccountModules API */
export declare class AccountModulesService extends BaseDomainService {
    protected readonly resourcePath = "accountmodules";
    /** GET /accountmodules/aging */
    getAging(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /accountmodules/patientbalances */
    getPatientBalances(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /accountmodules/servicedateview */
    getServiceDateView(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
}
//# sourceMappingURL=AccountModulesService.d.ts.map