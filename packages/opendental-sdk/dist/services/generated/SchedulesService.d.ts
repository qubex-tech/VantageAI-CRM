import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Schedules API */
export declare class SchedulesService extends BaseDomainService {
    protected readonly resourcePath = "schedules";
    /** GET /schedules */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
}
//# sourceMappingURL=SchedulesService.d.ts.map