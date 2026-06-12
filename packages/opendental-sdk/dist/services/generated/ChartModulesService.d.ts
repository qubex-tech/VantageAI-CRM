import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental ChartModules API */
export declare class ChartModulesService extends BaseDomainService {
    protected readonly resourcePath = "chartmodules";
    /** GET /chartmodules/prognotes */
    getProgNotes(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /chartmodules/patientinfo */
    getPatientInfo(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /chartmodules/plannedappts */
    getPlannedAppts(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
}
//# sourceMappingURL=ChartModulesService.d.ts.map