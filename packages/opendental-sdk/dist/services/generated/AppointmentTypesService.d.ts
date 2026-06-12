import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental AppointmentTypes API */
export declare class AppointmentTypesService extends BaseDomainService {
    protected readonly resourcePath = "appointmenttypes";
    /** GET /appointmenttypes */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
}
//# sourceMappingURL=AppointmentTypesService.d.ts.map