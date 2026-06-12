import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental ClockEvents API */
export declare class ClockEventsService extends BaseDomainService {
    protected readonly resourcePath = "clockevents";
    /** GET /clockevents */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
}
//# sourceMappingURL=ClockEventsService.d.ts.map